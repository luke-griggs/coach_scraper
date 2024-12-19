import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import puppeteer from "puppeteer";
import { Browser } from "puppeteer";
import {promises as fs} from "fs"

const openai = new OpenAI({apiKey: process.env.OPENAI_API_KEY})


const WEBSITE_SCRAPE_TIMEOUT = 180000; // 3 minutes
const OPENAI_RESPONSE_TIMEOUT = 300000; // 5 minutes

let browser: Browser

async function scrapeWebsite(url: string) {
    browser = await puppeteer.launch()
    const page = await browser.newPage();
    
    try {
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
        
        const bodyText = await page.evaluate(() => {
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

async function processCoachesSite(coachesSite: string, assistantId: string, isLast: boolean, outputFilename: string) {
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

        if (lastAssistantMessage) {
            console.log("Extracted and structured data:");
            const extractedData = lastAssistantMessage.content[0].text.value; // ignore this error lol
            console.log(extractedData);

            // const jsonData = JSON.parse(extractedData);
            // appendToOutputFile(jsonData, isLast, outputFilename);
            console.log(`Data appended to ${outputFilename}`);
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

    const schoolUrlArray = urlArray;
    console.log(schoolUrlArray)

    // initializeOutputFile(outputFilename);

    const assistant = await openai.beta.assistants.create({
        name: "University Athletic Department Data Extractor",
        instructions: `
            I need you to filter through this data for me and find the following information for any coach or recruiting coordinator for ${gender}'s ${sport}: 
            first name, last name, email, twitter/x, coaches title(this should be just their title, don't include the school/sport). 
    
            Return it to me as comma separated JSONs that follow this format, using these same fields:
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
            If the data that you're filtering thorugh doesn't include a certain field, then leave the field as an empty string
        `,   
        model: "gpt-4o-mini",
    });
    console.log("Assistant created:", assistant.id);

    for (let i = 0; i < schoolUrlArray.length; i++) {
        console.log("attempting to process site", schoolUrlArray[i]);
        const site = schoolUrlArray[i];
        const isLast = i === schoolUrlArray.length - 1;

        await processCoachesSite(site, assistant.id, isLast, outputFilename);   
    }

    // finalizeOutputFile(outputFilename);
    // console.log(`All data saved to ${outputFilename}`);

    // mergeAll(outputFilename);
    await browser.close()
   
}


export async function POST(request: NextRequest){
    const body = await request.text();
    const data = JSON.parse(body);
    getCoachContacts("", data.urls, data.sport, data.gender)
    return NextResponse.json("")
}