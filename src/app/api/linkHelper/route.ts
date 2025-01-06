import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer-extra";

export async function POST(request: NextRequest) {

  const body = await request.text();
  const data = JSON.parse(body);

  async function getUrl() {
    const browser = await puppeteer.launch(); // Launch browser
      const page = await browser.newPage();

      const schoolDirectory = `${data.schoolName} athletic staff directory`;

      try {
        await page.goto(
        `https://duckduckgo.com/?q=${encodeURIComponent(schoolDirectory)}`,
          { waitUntil: "domcontentloaded", timeout: 60000 }
        );

        // Wait for search results to load
        await page.waitForSelector('[data-testid="result-title-a"]');

        // Grab the first result link
        const directoryUrl = await page.evaluate(() => {
            const result = document.querySelector('[data-testid="result-title-a"]'); // Select the first search result. use .querySelector('div#search a') for google
            return result ? result.getAttribute("href") : "";   
        });

        console.log("Link for " + data.schoolName + ": " + directoryUrl);

        await page.close(); 
        await browser.close()
        return directoryUrl
      } catch (error) {
        console.error(error);
      }
    }

  const result = await getUrl();

  console.log("result being sent from linkHelper: " + result)

  return NextResponse.json(result);
}
