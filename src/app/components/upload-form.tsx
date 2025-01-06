"use client"


import React, { useState } from "react"
import Papa from "papaparse"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { FaBasketball } from "react-icons/fa6";
import { FaBaseball } from "react-icons/fa6";
import { FaFootballBall } from "react-icons/fa";
import { IoIosBaseball } from "react-icons/io";
import { FaVolleyballBall } from "react-icons/fa";
import { FaRunning } from "react-icons/fa";
import { MdOutlineSportsHockey } from "react-icons/md";
import { GiSoccerBall } from "react-icons/gi";
import toast from "react-hot-toast"

interface School{
  school: string
}

async function getURLs(schoolArray: string[], sport: string, gender: string) : Promise<string[]>{
  const data = { schoolArray, sport, gender }

  const response = await fetch("/api/getLinks", {
    method: "POST",
    headers: { "Content-Type": "application/json"},
    body: JSON.stringify(data)
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
  csv.name
  return new Promise((resolve, reject) => {
    
    Papa.parse(csv, {
      header: false,
      skipEmptyLines: true,
      complete: function (results) {
        const parsedArray = results.data as Array<Array<string>>
        for (var i = 1; i < parsedArray.length; i++){ //start iteration at 1 to skip the header row
          schoolsArray.push(parsedArray[i][0]) // take the results from the parsed csv input and store them in the schoolsArray
        }
        toast.success('Form submitted successfully', {
          position: "bottom-right",
          duration: 6000,
          style: {
            backgroundColor: "#090909",
            border: '1px solid #FFFFFF',
            padding: '16px',
            color: '#FFFFFF',
          },
          iconTheme: {
            primary: '#090909',
            secondary: '#FFFAEE',
          },
        });
    
        resolve(); // Signal that parsing is done
      },
      error: function (error) {
        toast.error('could not parse csv', {
          position: "bottom-right",
          duration: 6000,
          style: {
            backgroundColor: "#090909",
            border: '1px solid #FFFFFF',
            padding: '16px',
            color: '#FFFFFF',
          },
          iconTheme: {
            primary: '#090909',
            secondary: '#FFFAEE',
          },
        });
        reject(error); // Signal if there’s an error
      },
    });
  });
}



async function handleSubmit(e: React.FormEvent<HTMLFormElement>){
  e.preventDefault()

  const formData = new FormData(e.currentTarget)

  const schoolCsv = formData.get('schoolCsv')
  const sportValue = formData.get('sport') as string
  const genderValue = formData.get('gender') as string


  var formattedSchoolsArray: string[] = [] // stores the array of schools

  try {
    // Parse CSV
    await parseCsv(schoolCsv, formattedSchoolsArray);

    // Get URLs
    const urls = await getURLs(formattedSchoolsArray, sportValue, genderValue);

    console.log("HERE IS THE SPORT AND GENDER: " + sportValue + " and " + genderValue)

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
  const [sport, setSport] = useState("")
  const [gender, setGender] = useState("")

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* CSV file upload */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="schoolCsv" className="text-sm font-semibold">
          Upload CSV
        </Label>
        <Input
          id="schoolCsv"
          name="schoolCsv"
          type="file"
          accept=".csv"
          required
        />
        <p className="text-xs text-slate-400">
          Please upload a .csv file containing the list of schools.
        </p>
      </div>

      {/* Sport Select */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="sport" className="text-sm font-semibold">
          Select Sport
        </Label>
        <Select name="sport" value={sport} onValueChange={setSport} required>
          <SelectTrigger id="sport" name="sport" className="w-[200px]">
            <SelectValue placeholder="Select a sport" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Baseball"><div className="flex items-center gap-2"><FaBaseball />Baseball </div></SelectItem>
            <SelectItem value="Football"><div className="flex items-center gap-2"><FaFootballBall />Football </div></SelectItem>
            <SelectItem value="Basketball"><div className="flex items-center gap-2"><FaBasketball /> Basketball</div></SelectItem>
            <SelectItem value="Softball"><div className="flex items-center gap-2"><IoIosBaseball /> Softball</div></SelectItem>
            <SelectItem value="Soccer"><div className="flex items-center gap-2"><GiSoccerBall /> Soccer</div></SelectItem>
            <SelectItem value="Volleyball"><div className="flex items-center gap-2"><FaVolleyballBall />Volleyball</div></SelectItem>
            <SelectItem value="Track"><div className="flex items-center gap-2"><FaRunning />Track</div></SelectItem>
            <SelectItem value="Hockey"><div className="flex items-center gap-2"><MdOutlineSportsHockey />Hockey </div></SelectItem>            
          </SelectContent>
        </Select>
      </div>

      {/* Gender Select */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="gender" className="text-sm font-semibold">
          Select Gender
        </Label>
        <Select name="gender" value={gender} onValueChange={setGender} required>
          <SelectTrigger id="gender" name="gender" className="w-[200px]">
            <SelectValue placeholder="Select a gender" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Mens">Mens</SelectItem>
            <SelectItem value="Womens">Womens</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Submit button */}
      <Button variant="default" type="submit" className="w-full sm:w-auto">
        Submit
      </Button>
    </form>
  )
}

export default UploadForm;
