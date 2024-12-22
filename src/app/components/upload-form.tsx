"use client"

import React from "react";
import Papa from "papaparse"

interface School{
  name: string
}


async function getURLs(schoolsArray: string[]) : Promise<string[]>{
  const response = await fetch("/api/getLinks", {
    method: "POST",
    headers: { "Content-Type": "application/json"},
    body: JSON.stringify(schoolsArray)
  })

  if (!response.ok){ throw new Error("Failed to fetch from Api")}
  return response.json();
}


async function getCoachData(urls: Array<string>, sport: string, gender: string) : Promise<string>{
  const data = { urls, sport, gender }

  const response = await fetch("/api/processSites", {
    method: "POST",
    headers: { "Content-Type": "Application/json"},
    body: JSON.stringify(data)
    })

    return response.json()
  } 

async function sendCsv(csv: any){

    const response = await fetch("api/send", {
      method: "POST",
      headers: { "Content-Type": "text/plain"},
      body: csv
    })
    const result = await response.json()

    if (result.success){
      console.log("file emailed successfully!")
    } else {
      console.error('Failed to send CSV:', result.error || 'Unknown error');
    }

}

function parseCsv(csv: any, schoolsArray: string[]): Promise<void> {

  return new Promise((resolve, reject) => {
    Papa.parse(csv, {
      header: true,
      skipEmptyLines: true,
      complete: function (results) {
        const parsedArray = results.data as School[]
        for (var i = 0; i < parsedArray.length; i++){
          schoolsArray.push(parsedArray[i].name) // take the results from the parsed csv input and store them in the schoolsArray
        }
        resolve(); // Signal that parsing is done
      },
      error: function (error) {
        reject(error); // Signal if there’s an error
      },
    });
  });
}



async function handleSubmit(e: React.FormEvent<HTMLFormElement>){
  e.preventDefault()

  const formData = new FormData(e.currentTarget)

  const schoolCsv = formData.get('schoolCsv')
  const sportValue = formData.get('Sport') as string
  const genderValue = formData.get('Gender') as string


  var formattedSchoolsArray: string[] = [] // stores the array of schools

  try {
    // Parse CSV
    await parseCsv(schoolCsv, formattedSchoolsArray);

    // Get URLs
    const urls = await getURLs(formattedSchoolsArray);

    // Fetch coach data
    const coachData = await getCoachData(urls, sportValue, genderValue);
    console.log("Here is the csv data being returned from getCoachData: " + coachData)


    // Send CSV via email
    await sendCsv(coachData);

    console.log("Workflow completed successfully!");
  } catch (error) {
    console.error("An error occurred:", error);
  }
}
  


const UploadForm = () => {
  return (
    <div className="w-full h-auto mx-auto">
      <form onSubmit={handleSubmit} action="submit">
        <div className="flex-col">
          <div>
            <input id="schoolCsv" name="schoolCsv" type="file" accept="csv" required/>
            <select name="Sport" id="Sport" className="text-black" required>
              <option value="Basketball">Basketball</option>
              <option value="Football">Football</option>
              <option value="Baseball">Baseball</option>
            </select>
            <select name="Gender" id="Gender" className="text-black" required>
              <option value="Mens">Mens</option>
              <option value="Womens">Womens</option>
            </select>
          </div>
          <div className="pt-4">
            <button className="bg-white text-black p-2 rounded-md hover:bg-gray-200 duration-200" type="submit">submit</button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default UploadForm;
