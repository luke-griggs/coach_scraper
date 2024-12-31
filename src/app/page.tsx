"use client"

import React from "react"

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"

import UploadForm from "@/app/components/upload-form"
import { ModeToggle } from "@/components/ui/theme-toggle"

export default function DashboardPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background p-8">
      <main className="w-full max-w-2xl mx-auto text-white">
        {/* Page Heading */}
        <div className="mb-8 text-center space-y-2">
          <h1 className="text-3xl font-bold sm:text-4xl text-black dark:text-white">College Coaches Scraper</h1>
          <p className="text-sm text-gray-700 sm:text-base dark:text-slate-300">
            Upload a CSV with a list of schools, choose your sport and gender,
            and you&apos;ll receive an email containing the resulting coach data when the scraping is complete.
          </p>
        </div>

        {/* Card Container */}
        <Card className="shadow-lg mb-4">
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Get Started</CardTitle>
            <CardDescription className="text-slate-400">
              Follow the steps below to scrape coach info
            </CardDescription>
          </CardHeader>

          <CardContent>
            <UploadForm />
          </CardContent>

          <CardFooter className="text-sm text-slate-400">
            you&apos;ll receive the processed CSV to your email once complete.
          </CardFooter>
        </Card>
        <ModeToggle />
      </main>
    </div>
  )
}



