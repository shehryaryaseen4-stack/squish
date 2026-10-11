'use strict';
// Resume guides (/guides/<slug>), shown when the PDF editor (and so the Resume Builder) is on.
// Same shape and rules as content/articles.js; `tools` are Resume Builder pages, which link back.

module.exports = [
  {
    slug: 'how-to-write-a-resume',
    title: 'How to Write a Resume: Step-by-Step Guide with Free Templates',
    h1: 'How to write a resume, step by step',
    desc: 'How to write a resume that gets interviews: the right format, what to put in each section, examples, and free resume templates to download as PDF.',
    date: '2026-10-11',
    tools: ['/resume-maker', '/ats-resume-template', '/fresher-resume'],
    intro: 'A recruiter decides in about seven seconds whether to read your resume properly. This guide shows what to put in each section, in which order and with which words, so those seconds count. Every step works with the free templates in our Resume Builder.',
    sections: [
      ['1. Pick the right format', `<p>Most people should use the <strong>reverse-chronological</strong> format: your newest job first. It is what recruiters expect and what applicant tracking systems read best. A <strong>skills-based (functional)</strong> format can help career changers, and a <strong>combination</strong> format suits people with a strong mix of skills and experience. Keep it to one page if you have under ten years of experience.</p>
<p>Start from a template so the layout is done for you: open the <a href="/resume-maker">Resume Builder</a>, pick a design, and click any text to replace it.</p>`],
      ['2. Contact details', '<p>Put your full name in large type, then phone, a professional email address, city and country, and a LinkedIn or portfolio link. You do not need your full address. Add a photo, date of birth or nationality only if it is normal in the country you apply to (common in Pakistan, the Gulf and parts of Europe; avoided in the US and UK).</p>'],
      ['3. A two-line profile', '<p>Under your name, write two or three lines: who you are, your strongest skill or achievement, and the job you want. Example: <em>"Registered nurse with seven years in surgical wards. Trained 25 new nurses in patient safety. Looking for a senior nurse role in a teaching hospital."</em></p>'],
      ['4. Work experience that shows results', `<p>For each job write the title, employer, city and dates, then two to four lines that start with an action word and end with a result:</p>
<ul><li>Built the rider tracking service used by 1 million people.</li><li>Cut month-end closing from 10 to 6 working days.</li><li>Grew online sales by 60 percent in two years.</li></ul>
<p>Numbers make claims believable: percentages, money, people, time saved. Job-specific examples are in our templates for <a href="/software-engineer-resume">software engineers</a>, <a href="/nurse-resume">nurses</a>, <a href="/teacher-resume">teachers</a> and <a href="/sales-resume">sales</a>.</p>`],
      ['5. Education', '<p>List your degrees, newest first, with the institution and year. Add your grade only if it is strong. If you are a student or fresh graduate, put Education above Experience; see <a href="/guides/resume-for-freshers">resume for freshers</a>.</p>'],
      ['6. Skills, languages and extras', '<p>List six to ten skills that match the job advert, using the same words it uses. Add languages with your level, certifications (PMP, ACCA, AWS, BLS) and a short Achievements section for awards. Read <a href="/guides/skills-for-resume">skills to put on a resume</a> for examples by job.</p>'],
      ['7. Check, save as PDF and send', '<p>Read it aloud to catch mistakes, ask a friend to check it, and make sure dates line up. Download it as a PDF so it looks the same on every computer, and name it <em>firstname-lastname-resume.pdf</em>.</p>'],
    ],
    faq: [
      ['How long should a resume be?', 'One page for most people; two pages for senior roles or more than ten years of experience.'],
      ['What is the best resume format?', 'Reverse-chronological (newest job first) for most people, in a clean one or two-column layout.'],
      ['Should I write a resume in first person?', 'Leave out "I": start lines with action words such as built, led, improved, managed.'],
      ['Where can I make a resume for free?', 'In the Flipit Free Resume Builder: 30 templates, editable in your browser, downloadable as PDF without a watermark or sign-up.'],
    ],
  },
  {
    slug: 'resume-for-freshers',
    title: 'Resume for Freshers With No Experience: Format and Examples',
    h1: 'How to write a resume with no experience',
    desc: 'Resume format for freshers, students and graduates with no work experience: what to write, examples of projects and internships, and free templates.',
    date: '2026-10-11',
    tools: ['/fresher-resume', '/resume-maker', '/cv-maker'],
    intro: 'Everyone starts with no experience. Employers hiring freshers know that; they look for potential: what you studied, what you built or organised, and whether you write clearly. Here is how to show it on one page.',
    sections: [
      ['The fresher resume format', '<ol><li>Name and contact details</li><li>Profile: two lines on your degree and the job you want</li><li>Education (first, because it is your strongest section)</li><li>Internships, projects or part-time work</li><li>Activities and achievements</li><li>Skills and languages</li></ol><p>Open the <a href="/fresher-resume">fresher resume templates</a>; they already follow this order.</p>'],
      ['Turn student life into experience', '<p>Internships, final-year projects, society roles, event organising, tutoring, volunteering, freelancing and part-time jobs all count. Write them like jobs: what you did and one result. <em>"Organised a careers fair for 400 students with 12 companies."</em></p>'],
      ['Skills freshers can honestly list', '<p>MS Excel, Word and PowerPoint; languages; programming or design tools you used in projects; report writing; presentations; teamwork. Only list what you can talk about in an interview.</p>'],
      ['Mistakes to avoid', '<ul><li>Long career objectives: keep the profile to two lines.</li><li>Unprofessional email addresses.</li><li>Spelling mistakes: read it twice.</li><li>Two pages: one is enough.</li></ul>'],
    ],
    faq: [
      ['What should I write in a resume if I have no experience?', 'Your education, projects, internships, activities and skills, each with a short result.'],
      ['Should freshers add hobbies?', 'Only if they show something useful, such as team sports, debating or volunteering, and keep it to one line.'],
      ['Should I write CGPA?', 'Yes if it is 3.0 out of 4 or 70 percent and above.'],
    ],
  },
  {
    slug: 'ats-friendly-resume',
    title: 'ATS-Friendly Resume: How to Get Past Applicant Tracking Systems',
    h1: 'How to make an ATS-friendly resume',
    desc: 'What an applicant tracking system (ATS) is, how it reads your resume, and how to format and word your resume so it gets through. With free ATS templates.',
    date: '2026-10-11',
    tools: ['/ats-resume-template', '/resume-maker'],
    intro: 'Most large companies send resumes through an applicant tracking system before a person sees them. The system reads your text and ranks it against the job advert. A good resume can be ranked low just because the system could not read it. Here is how to avoid that.',
    sections: [
      ['How an ATS reads your resume', '<p>The system extracts the text from your file, splits it into sections by their headings, and looks for the skills, job titles and qualifications the recruiter asked for. Anything it cannot read (text inside images, unusual headings, scanned pages) is lost.</p>'],
      ['Formatting rules', '<ul><li>Use standard headings: Summary, Work Experience, Education, Skills.</li><li>One column, or two clearly separated columns.</li><li>Real text in standard fonts; no text in pictures.</li><li>Dates in one format, e.g. 2021 - 2024.</li><li>Save as PDF with selectable text, or as Word if asked.</li></ul><p>The <a href="/ats-resume-template">ATS resume templates</a> follow all of these.</p>'],
      ['Keywords: match the job advert', '<p>Copy the skills and tools from the job advert into your Skills section and job lines, using the same words ("Microsoft Excel", not just "spreadsheets"). Do not paste a list of keywords in white text: systems and recruiters catch it.</p>'],
      ['Test it', '<p>Open your PDF and copy all the text into a plain text editor. If it comes out in a sensible order, an ATS can read it too.</p>'],
    ],
    faq: [
      ['Is a PDF resume ATS-friendly?', 'Yes, as long as the text is real, selectable text and not a scanned image.'],
      ['Do ATS systems read two-column resumes?', 'Most modern ones do. Older systems can mix up columns, so use a one-column design for big-company online forms.'],
      ['Can I use colour?', 'Yes. Colour does not affect an ATS; the layout and text do.'],
    ],
  },
  {
    slug: 'resume-vs-cv',
    title: 'Resume vs CV: The Difference and Which One You Need',
    h1: 'Resume vs CV: what is the difference?',
    desc: 'The difference between a resume and a CV, what each one contains, which countries use which, and how long each should be. With free templates for both.',
    date: '2026-10-11',
    tools: ['/cv-maker', '/resume-maker'],
    intro: 'Resume and CV are used for the same thing in some countries and for different documents in others. Knowing which one an employer means saves you from sending the wrong length or format.',
    sections: [
      ['Resume', '<p>A short, targeted summary of your work history and skills, usually one page and at most two. You adjust it for each job. Standard in the US and Canada and for most private-sector jobs worldwide.</p>'],
      ['CV (curriculum vitae)', '<p>In the UK, Pakistan, India, the Gulf and much of Europe, "CV" simply means the same short document as a resume, sometimes with a photo and personal details. In academia and medicine everywhere, a CV is a longer, complete record: education, research, publications, conferences, teaching and awards, often many pages.</p>'],
      ['Biodata', '<p>Common in South Asia for government jobs and some private ones: a resume plus personal details such as date of birth, nationality, marital status and father\'s name. Add those lines to any template in the <a href="/cv-maker">CV maker</a>.</p>'],
      ['Which one to send', '<p>Follow the job advert. If it says CV and you apply in Pakistan, the UK or the Gulf, send a one or two-page document like a resume. If you apply for an academic or research post, send the full academic CV.</p>'],
    ],
    faq: [
      ['Is a CV longer than a resume?', 'An academic CV is; in most countries a job CV is the same length as a resume, one or two pages.'],
      ['Do I need a photo on a CV?', 'In Pakistan, the Gulf and parts of Europe it is common; in the US, UK and Canada leave it out.'],
      ['Can I make both here?', 'Yes. The same templates work for a resume, a CV or a biodata.'],
    ],
  },
  {
    slug: 'cv-format-pakistan-gulf',
    title: 'CV Format for Jobs in Pakistan, UAE and Saudi Arabia',
    h1: 'CV format for jobs in Pakistan and the Gulf',
    desc: 'The CV format employers in Pakistan, the UAE, Saudi Arabia and Qatar expect: personal details, photo, sections and tips, with free CV templates to download.',
    date: '2026-10-11',
    tools: ['/cv-maker', '/resume-maker', '/civil-engineer-resume'],
    intro: 'Employers in Pakistan and the Gulf read CVs a little differently from those in the US or UK. They often expect a photo and personal details, and they care about visa status and notice period. This is the format that works.',
    sections: [
      ['The sections, in order', '<ol><li>Name, job title, phone (with country code), email, city</li><li>Photo (passport style) in the corner</li><li>Profile: two or three lines</li><li>Work experience, newest first</li><li>Education and certifications</li><li>Skills and languages (English, Urdu, Arabic and level)</li><li>Personal details: nationality, date of birth, visa status, notice period, driving licence</li><li>References: available on request</li></ol>'],
      ['Gulf-specific tips', '<ul><li>State your visa status (residence visa, visit visa, transferable) and notice period clearly.</li><li>Mention Gulf experience and any local licence (DHA, MOH, Saudi Council of Engineers, SCFHS).</li><li>Write salaries only if asked.</li><li>Arabic is a plus: list it with your level.</li></ul>'],
      ['Pakistan-specific tips', '<ul><li>Government jobs often ask for CNIC, domicile and father\'s name: add them under personal details.</li><li>Add your degree marks or CGPA for early-career roles.</li><li>Many companies accept a PDF CV by email: name it with your full name.</li></ul>'],
    ],
    faq: [
      ['Should I add a photo to my CV in Pakistan or Dubai?', 'Yes, a professional passport-style photo is common and often expected.'],
      ['How long should a CV be for Gulf jobs?', 'Two pages at most; one page for early-career roles.'],
      ['Can I make my CV in Word?', 'Make it here as a PDF; if an agency asks for Word, convert it with our PDF to DOCX converter.'],
    ],
  },
  {
    slug: 'skills-for-resume',
    title: 'Skills to Put on a Resume: 100+ Examples by Job',
    h1: 'Skills to put on a resume, with examples by job',
    desc: 'Which skills to put on your resume: hard and soft skills, examples for engineers, nurses, teachers, sales, marketing and more, and how to list them.',
    date: '2026-10-11',
    tools: ['/resume-maker', '/software-engineer-resume', '/nurse-resume', '/teacher-resume'],
    intro: 'The Skills section is the part of a resume that both recruiters and tracking systems read first. The trick is to list skills that match the job and that the rest of your resume proves.',
    sections: [
      ['Hard skills and soft skills', '<p><strong>Hard skills</strong> are teachable and testable: Excel, Python, AutoCAD, IV cannulation, Google Ads. <strong>Soft skills</strong> are how you work: communication, teamwork, leadership, problem solving. List mostly hard skills, and show soft skills through your job lines (for example "led a team of eight").</p>'],
      ['Examples by job', `<ul>
<li><strong>Software engineer:</strong> JavaScript, React, Node.js, SQL, AWS, Docker, Git (<a href="/software-engineer-resume">template</a>)</li>
<li><strong>Nurse:</strong> patient assessment, medication administration, wound care, infection control, BLS (<a href="/nurse-resume">template</a>)</li>
<li><strong>Teacher:</strong> lesson planning, classroom management, assessment, Google Classroom (<a href="/teacher-resume">template</a>)</li>
<li><strong>Accountant:</strong> IFRS reporting, reconciliations, tax returns, SAP, Excel (<a href="/accountant-resume">template</a>)</li>
<li><strong>Sales:</strong> prospecting, negotiation, key accounts, Salesforce (<a href="/sales-resume">template</a>)</li>
<li><strong>Marketing:</strong> SEO, Google Ads, social media, GA4, copywriting (<a href="/marketing-resume">template</a>)</li>
<li><strong>Engineer:</strong> AutoCAD, Revit, Primavera, site supervision, HSE (<a href="/civil-engineer-resume">template</a>)</li>
<li><strong>Data analyst:</strong> SQL, Python, Power BI, statistics (<a href="/data-analyst-resume">template</a>)</li>
<li><strong>Designer:</strong> Illustrator, Photoshop, Figma, typography, branding (<a href="/graphic-designer-resume">template</a>)</li>
<li><strong>Manager:</strong> team leadership, budgeting, Lean, KPIs, hiring (<a href="/manager-resume">template</a>)</li>
</ul>`],
      ['How many skills, and how to list them', '<p>Six to twelve skills is right. Put the ones from the job advert first, use the advert\'s words, and group them if you have many (Languages, Tools, Methods). Do not rate soft skills with stars or bars; it says little. Skill bars on creative designs are fine for tools and languages.</p>'],
    ],
    faq: [
      ['What are the best skills to put on a resume?', 'The skills named in the job advert that you really have, plus the core tools of your field.'],
      ['Should I list soft skills?', 'A few, but show them in your experience lines too, because claims alone are weak.'],
      ['Where does the Skills section go?', 'Near the top or in a sidebar, so it is seen in the first few seconds.'],
    ],
  },
];
