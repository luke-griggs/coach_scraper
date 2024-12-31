import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import puppeteer from "puppeteer";
import { Browser } from "puppeteer";
import { promises as fs } from "fs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const WEBSITE_SCRAPE_TIMEOUT = 180000; // 3 minutes
const OPENAI_RESPONSE_TIMEOUT = 300000; // 5 minutes

var browser = await puppeteer.launch();

async function scrapeWebsite(url: string) {
  if (!browser) {
    browser = await puppeteer.launch()
  }
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 40000 }); //80000 });

    const bodyText = await page.evaluate(async () => { // scroll so that all the content is visible, in case a site has conditional rendering
  
      let scrollPosition = 0
      let documentHeight = document.body.scrollHeight

      while (documentHeight > scrollPosition) {
        window.scrollBy(0, documentHeight)
        await new Promise(resolve => {
          setTimeout(resolve, 1500)
        })
        scrollPosition = documentHeight
        documentHeight = document.body.scrollHeight
      }
  
      const footer = document.querySelector('footer');
      if (footer) footer.remove();
      const scripts = document.querySelectorAll('script');
      scripts.forEach(script => script.remove());
      return document.body.innerText;
  });

    await page.close(); // Close just the page, not the browser
    return bodyText;
  } catch (error) {
    await page.close();
    await browser.close();
    throw error;
  }
}

async function processCoachesSite(coachesSite: string, assistantId: string) {
  if (!coachesSite) {
    console.log("No coaches site available for processing.");
    return;
  }

  try {
    console.log(`Scraping website: ${coachesSite}...`);
    const startTime = Date.now();
    const scrapedData = await Promise.race([
      scrapeWebsite(coachesSite),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Website scrape timed out")),
          WEBSITE_SCRAPE_TIMEOUT
        )
      ),
    ]);
    const scrapeDuration = Date.now() - startTime;
    console.log(
      `Website scraped successfully in ${scrapeDuration / 1000} seconds.`
    );

    const contentToSend = `${scrapedData}`;

    const thread = await openai.beta.threads.create();

    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: contentToSend,
    });

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId,
    });

    const openaiStartTime = Date.now();
    let runStatus;
    await Promise.race([
      (async () => {
        while (true) {
          runStatus = await openai.beta.threads.runs.retrieve(
            thread.id,
            run.id
          );
          if (runStatus.status === "completed") {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      })(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("OpenAI response timed out")),
          OPENAI_RESPONSE_TIMEOUT
        )
      ),
    ]);
    const openaiDuration = Date.now() - openaiStartTime;
    console.log(
      `OpenAI response received in ${openaiDuration / 1000} seconds.`
    );

    const messages = await openai.beta.threads.messages.list(thread.id);

    const lastAssistantMessage = messages.data
      .filter((message) => message.role === "assistant")
      .pop();

    if (
      lastAssistantMessage &&
      lastAssistantMessage.content[0].type == "text"
    ) {
      console.log("Extracted and structured data:");
      const extractedData = lastAssistantMessage.content[0].text.value;
      extractedData.replace(/```json\n?|```/g, ""); // to get rid of the weird ``` that gpt was adding to responses
      console.log(extractedData);

      const data = JSON.parse(extractedData)
      if (data.first_name)
      return JSON.parse(extractedData);
    } else {
      console.log("No response from the assistant.");
    }
  } catch (error: any) {
    await browser.close();
    console.error("An error occurred: ", error.message);
    // Don't add the site to the processed set if there was a timeout error
    if (
      error.message === "Website scrape timed out" ||
      error.message === "OpenAI response timed out"
    ) {
      console.log(`Skipping site due to timeout: ${coachesSite}`);
    } else {
      console.error(`Error processing site: ${coachesSite}`, error);
    }
  }
}

async function getCoachContacts(
  urlArray: Array<string>,
  sport: string,
  gender: string
) {
  var csv = "";

  try {
    const schoolUrlArray = urlArray;
    console.log(schoolUrlArray);

    const assistant = await openai.beta.assistants.create({
      name: "University Athletic Department Data Extractor",
      instructions: `
                I need you to filter through this data and extract information for the coaches and recruiting coordinators for ${gender}'s ${sport}. Do NOT include any operations, social media, or creative personnel.
    
    For each relevant individual, return the following information:
    
    first_name: The coach's first name. If the first and last names are combined, split them logically (e.g., "John Doe" becomes first_name: John, last_name: Doe).
    last_name: The coach's last name.
    email: The email address, or leave as an empty string if not available.
    twitter: The coach's Twitter/X handle, or an empty string if not available
    title: The coach's title (e.g., "head coach" or "assistant coach"). Do not include the school or sport in this field.
    school: The name of the college
    Output format:
    Do NOT include any additional formatting, such as triple backticks, json tags, or any text outside of the JSON array itself.
    Return the data as an ARRAY of valid JSON objects. Each object should contain exactly these 6 fields: first_name, last_name, email, twitter, title, school. Each JSON should therefore contain exactly 6 fields.
    No field should contain commas. If you need you put a comma due to someone having multiple roles, use a / instead
    
    Example output:
    
    [
        {
            "first_name": "John",
            "last_name": "Doe",
            "email": "johndoe@email.com",
            "twitter": null,
            "title": "head coach",
            "school": "Boston College"
        },
        {
            "first_name": "Tim",
            "last_name": "Jones",
            "email": "tjones@email.com",
            "twitter": "jones52",
            "title": "assistant coach",
            "school": "Boston College"
        }
    ]
    Notes:
    
    Ensure the output is strictly valid JSON. Any extraneous characters, like triple backticks or additional formatting, will invalidate the response.
    Leave any missing fields as an empty string ("").
    Ensure the output is strictly valid JSON. Do not include stray commas or any non-JSON content.
    Any personnel who's title contains a comma should be ignored. For example someone with the title "coordinator, player development" should NOT be included
    Only include data for coaches and recruiting personnel for ${gender}'s ${sport}.
            `,
      model: "gpt-4o-mini",
    });
    console.log("Assistant created:", assistant.id);

    const headers = [
      "first_name",
      "last_name",
      "email",
      "twitter",
      "title",
      "school",
    ];
    csv += headers.join(",") + "\n";
    for (let i = 0; i < schoolUrlArray.length; i++) {
      console.log("attempting to process site", schoolUrlArray[i]);

      if (!schoolUrlArray[i]) {
        console.log("this link was not found");
        break;
      }
      const site = schoolUrlArray[i];

      const coachData = await processCoachesSite(site, assistant.id);

      //rescrape full athletic directory if 

      coachData.forEach((object: Record<string, any>) => {
        const values = headers.map((header: string) => object[header]);
        csv += values.join(",") + "\n";
      });
    }

    console.log("HERE IS THE CSV: " + csv);
    return csv;
  } catch (error: any) {
    await browser.close();
    console.error("an error occurred: ", error.message);
  }
}

export async function POST(request: NextRequest) {
  const data = await request.json();
  const csv = await getCoachContacts(data.urls, data.sport, data.gender);
  await browser.close();
  return NextResponse.json(csv);
}
