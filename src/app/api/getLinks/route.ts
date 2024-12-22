import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer-extra";
import { Browser } from "puppeteer";


export async function POST(request: NextRequest) {
  const body = await request.text();
  const schools: Array<string> = JSON.parse(body);

  async function getUrls(schoolArray: Array<string>) {
    const res = []; // Array to store results

    for (const school of schoolArray) {
      const browser = await puppeteer.launch(); // Launch browser
      const page = await browser.newPage();

      const schoolDirectory = `${school} athletic staff directory`;

      try {
        await page.goto(
          `https://www.google.com/search?q=${encodeURIComponent(
            schoolDirectory
          )}`,
          { waitUntil: "networkidle0", timeout: 60000 }
        );

        // Wait for search results to load
        await page.waitForSelector("a");

        // Grab the first result link
        const firstLink = await page.evaluate(() => {
            const result = document.querySelector('div#search a'); // Select the first search result
            return result ? result.getAttribute("href") : null;   
        });

        res.push(firstLink); // Add the result to the array
        console.log("First Link:", firstLink);

        await browser.close(); // Close the browser
      } catch (error) {
        console.error(error);
      }
    }
    console.log("HERE ARE THE LINKS: " + res)
    return res; // Return the array of results
  }

  const result = await getUrls(schools);

  return NextResponse.json(result);
}
