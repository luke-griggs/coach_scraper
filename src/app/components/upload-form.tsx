"use client"

import React from "react";
import Papa from "papaparse"


async function handleSubmit(e: React.FormEvent<HTMLFormElement>){
  e.preventDefault()

  interface School{
    name: string
  }

  const formData = new FormData(e.currentTarget)

  const schoolCsv = formData.get('schoolCsv')
  const sportValue = formData.get('Sport')
  const genderValue = formData.get('Gender')


  var formattedSchoolsArray: string[] = [] // stores the array of schools

  Papa.parse(schoolCsv!, {
    header: true,
    skipEmptyLines: true,
    complete: function (results) {
      formatResults(results.data as School[])
    },
})


  function formatResults(schoolArray: Array<School>){ // formats the parsed csv into an array
    for (var i = 0; i < schoolArray.length; i++){
      formattedSchoolsArray.push(schoolArray[i].name)
    }
    getURLS();
  }


  async function getURLS(){
    try{
      const response = await fetch("/api/getLinks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formattedSchoolsArray)
      })
      if (!response.ok){
        throw new Error("Failed to fetch from Api");
      }
      const result = await response.json();
      console.log("API respose: ", result)

    } catch(error) {
      console.error("Error: ", error)
    }
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
