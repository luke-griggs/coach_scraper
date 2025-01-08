import fs from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  const coachData = await request.text();
  const filePath = path.join(process.cwd(), 'temp', 'coachData.csv');


  console.log("HERE IS THE COACH DATA: " + coachData)
  console.log("HERE IS THE PATH: " + filePath)

  try {
    // Write the file
    await fs.writeFile(filePath, coachData, 'utf-8');
    console.log("FILE SUCCESSFULLY WRITTEN")

    const csv = (await fs.readFile(filePath)).toString('base64')


    // Send the email
   await resend.emails.send({
      from: 'Luke <data@llluke.dev>',
      to: 'support@d1scholarship.com',
      subject: 'Coach Data CSV',
      html: '<p>Attached is the coach data CSV!</p>',
      attachments: [
        {
          content: csv,
          filename: 'coachData.csv',
        },
      ],
    });

    // Delete the temporary file
    await fs.rm(filePath);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('An error occurred:', error);

    // Clean up the file in case of error
    try {
      await fs.rm(filePath);
    } catch (cleanupError) {
      console.error('Error cleaning up file:', cleanupError);
    }

    return NextResponse.json({ success: false }, { status: 500 });
  }
}
