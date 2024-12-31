import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer-extra";

export async function POST(request: NextRequest) {

  const body = await request.text();
  const data = JSON.parse(body);

  async function getUrls(schoolArray: Array<string>) {
    const res = []; // Array to store results
    const browser = await puppeteer.launch(); // Launch browser

    for (const school of data.schoolArray) {
      const page = await browser.newPage();
      const schoolDirectory = `${school} ${data.gender} ${data.sport} staff`;

      try {
        await page.goto(
        `https://duckduckgo.com/?q=${encodeURIComponent(schoolDirectory)}`,
          { waitUntil: "domcontentloaded", timeout: 60000 }
        );

        // Wait for search results to load
        await page.waitForSelector('[data-testid="result-title-a"]');

        // Grab the first result link
        const firstLink = await page.evaluate(() => {
            const result = document.querySelector('[data-testid="result-title-a"]'); // Select the first search result. use .querySelector('div#search a') for google
            return result ? result.getAttribute("href") : "";   
        });

        res.push(firstLink); // Add the result to the array
        console.log("First Link:", firstLink);

        await page.close(); // Close the browser
      } catch (error) {
        console.error(error);
      }
    }
    browser.close()
    console.log("HERE ARE THE LINKS: " + res)
    return res; // Return the array of results
  }

  const result = await getUrls(data);

  return NextResponse.json(result);
}
