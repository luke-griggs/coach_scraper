import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import puppeteer from "puppeteer";
import { Browser } from "puppeteer";
import {promises as fs} from "fs"

const openai = new OpenAI({apiKey: process.env.OPENAI_API_KEY})


const WEBSITE_SCRAPE_TIMEOUT = 180000; // 3 minutes
const OPENAI_RESPONSE_TIMEOUT = 300000; // 5 minutes

let browser: Browser


// need to add to global csv
async function jsonToCsv(jsonData: Array<Record<string, any>>){ // parses json data into a csv
    var csv = ""
    const headers = Object.keys(jsonData[0]);
    csv += headers.join("\n");

    jsonData.forEach(object => {
        headers.map(header => 
            csv += object[header]
        )
    })
}

async function scrapeWebsite(url: string) {
    browser = await puppeteer.launch()
    const page = await browser.newPage();
    
    try {
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

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
        throw error;
    }
}

async function processCoachesSite(coachesSite: string, assistantId: string) {
    var csv = ""
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
                setTimeout(() => reject(new Error('Website scrape timed out')), WEBSITE_SCRAPE_TIMEOUT)
            )
        ]);
        const scrapeDuration = Date.now() - startTime;
        console.log(`Website scraped successfully in ${scrapeDuration / 1000} seconds.`);

        const contentToSend = `${scrapedData}`;

        const thread = await openai.beta.threads.create();

        await openai.beta.threads.messages.create(thread.id, {
            role: "user",
            content: contentToSend,
        });

        const run = await openai.beta.threads.runs.create(thread.id, { assistant_id: assistantId });

        const openaiStartTime = Date.now();
        let runStatus;
        await Promise.race([
            (async () => {
                while (true) {
                    runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
                    if (runStatus.status === "completed") {
                        break;
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            })(),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('OpenAI response timed out')), OPENAI_RESPONSE_TIMEOUT)
            )
        ]);
        const openaiDuration = Date.now() - openaiStartTime;
        console.log(`OpenAI response received in ${openaiDuration / 1000} seconds.`);

        const messages = await openai.beta.threads.messages.list(thread.id);

        const lastAssistantMessage = messages.data
            .filter(message => message.role === "assistant")
            .pop();

        if (lastAssistantMessage && lastAssistantMessage.content[0].type == "text") {
            console.log("Extracted and structured data:");
            const extractedData = lastAssistantMessage.content[0].text.value;
            console.log(extractedData);
            extractedData.replace(/```json\n?|```/g, ''); // to get rid of the weird ``` that gpt was adding to responses
            return JSON.parse(extractedData)
        } else {
            console.log("No response from the assistant.");
        }
    } catch (error: any) {
        console.error("An error occurred:", error.message);
        // Don't add the site to the processed set if there was a timeout error
        if (error.message === 'Website scrape timed out' || error.message === 'OpenAI response timed out') {
            console.log(`Skipping site due to timeout: ${coachesSite}`);
        } else {
            console.error(`Error processing site: ${coachesSite}`, error);
        }
    }

}

async function getCoachContacts(outputFilename: string, urlArray: Array<string>, sport: string, gender: string) {
    var csv = ""

    const schoolUrlArray = urlArray;
    console.log(schoolUrlArray)

    // initializeOutputFile(outputFilename);

    const assistant = await openai.beta.assistants.create({
        name: "University Athletic Department Data Extractor",
        instructions: `
            I need you to filter through this data for me and find the information for any coach or recruiting role for ${gender}'s ${sport} do NOT include any operations/social media/creative personel. I need you to find the following information for each coach/recruiting personel: 
            first name, last name, email, twitter/x, coaches title(this should be just their title, don't include the school/sport). 
    
            Return it to me as an array of comma separated JSONs that adhere to the following format, using the same fields. To be clear, your response should contain nothing except the jsons:
            {
                "first_name": "John",
                "last_name": "Doe",
                "email": johndoe@email.com,
                "twitter": null,
                "title": head coach
            },
            {
                "first_name": "Tim",
                "last_name": "Jones",
                "email": tjones@email.com,
                "twitter": jones52,
                "title: assistant coach
            }
            If the data that you're filtering thorugh doesn't include a certain field, then leave the field as an empty string. As a reminder, I only want the data for coaches and recruiting personel for ${gender}'s ${sport}. Do not include the random triple backtick and json in the response
        `,   
        model: "gpt-4o-mini",
    });
    console.log("Assistant created:", assistant.id);

    const headers = ["first_name", "last_name", "email", "twitter", "title"]
    csv += headers.join(",") + "\n";
    for (let i = 0; i < schoolUrlArray.length; i++) {
        console.log("attempting to process site", schoolUrlArray[i]);
        const site = schoolUrlArray[i];

        const coachData = await processCoachesSite(site, assistant.id); 
        
        coachData.forEach((object: Record<string, any>) => {
            const values = headers.map((header: string) => 
               object[header]
            );
            csv += values.join(",") + "\n";
        });
    }
    
    await browser.close()
    console.log("HERE IS THE CSV: " + csv)
    return csv;
}


export async function POST(request: NextRequest){
    const data = await request.json()
    const csv = await getCoachContacts("", data.urls, data.sport, data.gender)
    return NextResponse.json(csv)
}