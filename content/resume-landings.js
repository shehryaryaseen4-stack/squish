'use strict';
// Resume pages for search (all part of the Resume Builder, see content/editor-landings.js):
// one per job ("nurse resume", "software engineer resume" ...) and one per style ("ATS resume
// template", "CV maker" ...). Each is the resume builder with its own text; job pages show the
// resume designs filled in for that job first (feature: template ids, chip: tab label), style
// pages open on their style tab (style).
//
// Resume designs resume-1 ... resume-28 (public/editor-templates.js) are filled in for ten
// sample people so that each person appears in three different layouts: design resume-(i + 1)
// belongs to person (3i + 3 floor(i / 10)) % 10. byPerson() lists them.

const PERSON = { software: 0, marketing: 1, nurse: 2, civil: 3, teacher: 4, fresher: 5, designer: 6, sales: 7, data: 8, manager: 9 };
const byPerson = (p) => Array.from({ length: 28 }, (_, i) => i).filter((i) => (3 * i + 3 * Math.floor(i / 10)) % 10 === p).map((i) => `resume-${i + 1}`);

const R = (id, name) => `<a href="/resume-maker?template=${id}">${name}</a>`;
const skillsList = (items) => `<ul class="pe-cols">${items.map((s) => `<li>${s}</li>`).join('')}</ul>`;

const job = (o) => ({
  kind: 'resume', cat: 'resume', only: 'resume', kicker: 'Free resume template', ...o,
  panel: [`${o.chip} resume templates`, `Ready-made ${o.chip.toLowerCase()} resumes first, then every other design. Click one to open it and replace the sample text with your own.`],
});

module.exports = [
  // ------------------------------------------------------------------- jobs --
  job({
    slug: 'software-engineer-resume', short: 'Software engineer resume', chip: 'Software engineer', feature: byPerson(PERSON.software),
    title: 'Software Engineer Resume Template - Free PDF Download',
    desc: 'Free software engineer and developer resume templates. Edit a ready-made resume with real tech skills and projects, then download it as a PDF.',
    h1: 'Software Engineer Resume Template',
    lede: 'Resume templates for software engineers, web developers and programmers, already filled in with real examples. Open one, add your own projects and skills, and download a clean PDF.',
    sections: [
      ['What recruiters look for in a developer resume', '<p>Tech recruiters scan for three things: the languages and frameworks you use, what you built with them, and the impact. Write each job as "Built X with Y, which led to Z": <em>"Built the rider tracking service in Node.js, used by 1 million people."</em> Put a Skills section near the top with the exact names from the job advert (React, TypeScript, AWS, Docker), because applicant tracking systems match those words.</p>'],
      ['Skills to put on a software engineer resume', skillsList(['JavaScript, TypeScript', 'React, Next.js, Vue', 'Node.js, Python, Java, Go', 'SQL, PostgreSQL, MongoDB', 'AWS, Azure, Docker, Kubernetes', 'Git, CI/CD, testing', 'REST and GraphQL APIs', 'System design', 'Agile and Scrum'])],
      ['Projects, GitHub and links', '<p>No big-company experience yet? A Projects section with two or three things you built, each with a one-line result and a link to GitHub or a live demo, is just as convincing. Add your GitHub and portfolio links next to your email. Keep it to one page unless you have more than eight years of experience.</p>'],
    ],
    faq: [
      ['Should a software engineer resume be one page?', 'Yes for most developers with under eight years of experience. Senior engineers and architects can use two pages if every line shows impact.'],
      ['Do I need a photo on a developer resume?', 'Not in the US, UK or Canada. In Pakistan, the Gulf and parts of Europe a photo is common; the templates with a circle can hold one.'],
      ['Is the template ATS-friendly?', 'The text stays real text in the PDF, so applicant tracking systems can read it. For the safest choice, use one of the ATS-friendly designs.'],
    ],
  }),
  job({
    slug: 'nurse-resume', short: 'Nurse resume', chip: 'Nurse', feature: byPerson(PERSON.nurse),
    title: 'Nurse Resume Template - Free Nursing CV, Download PDF',
    desc: 'Free nurse resume and nursing CV templates for staff nurses and RNs. Add your licence, wards and skills, then download your resume as a PDF.',
    h1: 'Nurse Resume Template',
    lede: 'Resume and CV templates for registered nurses, staff nurses and nursing students, filled in with real ward experience. Make it yours in a few minutes and download a PDF.',
    sections: [
      ['How to write a nursing resume', '<p>Start with your licence or registration number (PNC, NMC, DHA, SCFHS or your state licence) right under your name: hospitals check it first. For each job, give the hospital, the ward or unit, how many beds or patients you cared for, and one or two results, such as training new nurses or a safety improvement. Add your certifications (BLS, ACLS, PALS) in their own section.</p>'],
      ['Nursing skills to include', skillsList(['Patient assessment', 'Medication administration', 'IV cannulation', 'Wound care', 'Infection control', 'Electronic health records', 'Critical care / ICU', 'Patient education', 'BLS, ACLS certified'])],
      ['Applying abroad: UK, Gulf, Saudi Arabia', '<p>Gulf and Saudi hospitals usually expect a photo, nationality and date of availability, plus your DataFlow or licence status. UK NHS applications focus on NMC registration and band-level experience. Keep one master CV and adjust the top section for each country.</p>'],
    ],
    faq: [
      ['What should a nurse put on a resume?', 'Your licence number, nursing education, each hospital and ward with dates, patient load, clinical skills, certifications such as BLS and ACLS, and languages.'],
      ['Can I make a nursing CV for Saudi Arabia or the UAE here?', 'Yes. Add a photo with Image, and your nationality, licence and availability at the top. Download it as a PDF to send to the hospital or agency.'],
      ['Is it free?', 'Yes. Edit and download as many versions as you need, with no watermark and no sign-up.'],
    ],
  }),
  job({
    slug: 'teacher-resume', short: 'Teacher resume', chip: 'Teacher', feature: byPerson(PERSON.teacher),
    title: 'Teacher Resume Template - Free, Edit and Download as PDF',
    desc: 'Free teacher resume and CV templates for primary, secondary and subject teachers. Add your classes, results and qualifications, then download as PDF.',
    h1: 'Teacher Resume Template',
    lede: 'Resume templates for teachers and teaching assistants, filled in with real classroom experience. Replace the sample text with your own and download a PDF for your school application.',
    sections: [
      ['How to write a teacher resume', '<p>Schools want to see what you teach, to whom and with what result. For each post, give the school, the classes or subjects, the number of pupils and one result, such as better exam or reading scores. Add extra roles (clubs, events, mentoring) because they show you take part in school life. List your teaching qualification (B.Ed, M.Ed, PGCE, QTS) near the top.</p>'],
      ['Teaching skills to include', skillsList(['Lesson planning', 'Classroom management', 'Differentiated teaching', 'Assessment and feedback', 'Special needs support', 'Google Classroom, MS Teams', 'Parent communication', 'Curriculum: Cambridge, Matric, IB', 'Extracurricular activities'])],
      ['Fresh teacher with no experience?', '<p>Put your teaching practice or internship first, with the school and grades you taught. Add tutoring, volunteering and any training workshops. A short, warm profile about why you teach helps a lot.</p>'],
    ],
    faq: [
      ['How long should a teacher resume be?', 'One page for new teachers, two at most for experienced teachers and heads of department.'],
      ['Should I add a photo?', 'Many schools in Pakistan, India and the Gulf expect one; in the UK and US it is better to leave it out.'],
      ['Can I also write the cover letter?', 'Yes. Use the matching cover letter template in the same builder.'],
    ],
  }),
  job({
    slug: 'civil-engineer-resume', short: 'Engineer resume', chip: 'Engineer', feature: byPerson(PERSON.civil),
    title: 'Civil Engineer Resume Template - Free Engineering CV PDF',
    desc: 'Free civil engineer and engineering resume templates. Show your projects, software and site experience, then download your CV as a PDF.',
    h1: 'Civil Engineer Resume Template',
    lede: 'Resume and CV templates for civil, site and project engineers, filled in with real project examples. Add your own projects and download a professional PDF.',
    sections: [
      ['How to write an engineering resume', '<p>Engineering managers look for the size of the projects you worked on, your role and the result. Give numbers: storeys, kilometres, budget, team size. Mention the software you use (AutoCAD, Revit, ETABS, Primavera) and your professional registration (PEC, Society of Engineers UAE, Saudi Council of Engineers).</p>'],
      ['Engineering skills to include', skillsList(['AutoCAD, Revit, Civil 3D', 'ETABS, SAP2000, STAAD', 'Primavera P6, MS Project', 'Quantity surveying, BOQ', 'Site supervision', 'Quality control', 'HSE and site safety', 'Contract management', 'Structural design'])],
      ['For Gulf and overseas jobs', '<p>Add your registration and its number, your visa status and notice period. A separate Projects list with the name, value and your role on each project is common for senior engineers.</p>'],
    ],
    faq: [
      ['Is this template only for civil engineers?', 'No. Mechanical, electrical and project engineers use the same layout: replace the projects, software and skills with your own.'],
      ['Can I add a projects list?', 'Yes. Duplicate a job block with Ctrl+D, or add a table with the Table tool for project name, value and role.'],
      ['Can I download it as Word?', 'Download the PDF, then convert it with our PDF to DOCX converter if a company asks for Word.'],
    ],
  }),
  job({
    slug: 'accountant-resume', short: 'Accountant resume', chip: 'Accountant', feature: ['resume-classic', 'resume-8', 'resume-13', 'resume-18', 'resume-27'],
    title: 'Accountant Resume Template - Free Finance CV, PDF Download',
    desc: 'Free accountant and finance resume templates: clean, classic layouts for ACCA, CA and B.Com graduates. Edit your CV online and download as PDF.',
    h1: 'Accountant Resume Template',
    lede: 'Clean, classic resume templates for accountants, auditors and finance professionals. Add your qualifications and experience and download a polished PDF.',
    sections: [
      ['How to write an accountant resume', '<p>Accounting employers value accuracy, so keep the layout clean and classic. Show your qualification (ACCA, CA, CMA, CPA, B.Com) at the top. For each job, list the work you did (month-end closing, audits, tax returns, financial statements) and a measurable result, such as closing the books faster or saving costs.</p>'],
      ['Accounting skills to include', skillsList(['Financial reporting (IFRS)', 'Month-end closing', 'Audit and internal controls', 'Tax returns', 'Accounts payable and receivable', 'Bank reconciliations', 'SAP, QuickBooks, Xero', 'Advanced Excel', 'Budgeting and forecasting'])],
    ],
    faq: [
      ['Which template is best for an accountant?', 'A classic or ATS-friendly design: simple columns, clear headings and standard fonts look professional and read well in tracking systems.'],
      ['Should I list my ACCA papers?', 'If you are still studying, write "ACCA, 9 of 13 papers passed" so employers see your progress.'],
      ['Is it free to download?', 'Yes, as a PDF, with no watermark and no sign-up.'],
    ],
  }),
  job({
    slug: 'sales-resume', short: 'Sales resume', chip: 'Sales', feature: byPerson(PERSON.sales),
    title: 'Sales Resume Template - Free Sales Executive CV, PDF',
    desc: 'Free sales executive and sales manager resume templates that show targets and numbers. Edit online and download your sales resume as a PDF.',
    h1: 'Sales Resume Template',
    lede: 'Resume templates for sales executives, sales officers and account managers, with real targets and results filled in. Swap in your own numbers and download a PDF.',
    sections: [
      ['Numbers sell a sales resume', '<p>Every sales job line should have a number: percent of target, revenue, new accounts, region size. <em>"Reached 118 percent of target in 2024"</em> beats "responsible for sales". Put your best year in the profile at the top. Mention the CRM you use, such as Salesforce or HubSpot.</p>'],
      ['Sales skills to include', skillsList(['Prospecting and lead generation', 'Key account management', 'Negotiation and closing', 'B2B and B2C sales', 'CRM: Salesforce, HubSpot', 'Sales forecasting', 'Market research', 'Presentations', 'Customer retention'])],
    ],
    faq: [
      ['What should a sales resume include?', 'Targets and results for each job, the products and markets you sold to, your CRM, and awards such as top salesperson of the year.'],
      ['I am new to sales. What do I write?', 'Use the fresher resume and highlight customer-facing work, internships, part-time jobs and any competitions you won.'],
      ['Can I download it as PDF?', 'Yes, free and without a watermark.'],
    ],
  }),
  job({
    slug: 'marketing-resume', short: 'Marketing resume', chip: 'Marketing', feature: byPerson(PERSON.marketing),
    title: 'Marketing Resume Template - Free Digital Marketing CV PDF',
    desc: 'Free marketing and digital marketing resume templates. Show campaigns, channels and results, then download your marketing resume as a PDF.',
    h1: 'Marketing Resume Template',
    lede: 'Resume templates for marketing managers, digital marketers and social media specialists, filled in with real campaign results. Make it yours and download a PDF.',
    sections: [
      ['How to write a marketing resume', '<p>Show the channels you used and the results you got: traffic, leads, sales, cost per lead, followers. Name the tools (Google Ads, Meta Ads, GA4, HubSpot, Canva). A link to a portfolio or case studies next to your email helps a lot for creative and social media roles.</p>'],
      ['Marketing skills to include', skillsList(['Digital strategy', 'Google Ads, Meta Ads', 'SEO and content marketing', 'Social media management', 'Email marketing', 'Google Analytics (GA4)', 'Copywriting', 'Brand management', 'Marketing automation'])],
    ],
    faq: [
      ['Should a marketing resume be creative?', 'A little colour is fine for marketing; the Creative and Modern designs suit most roles. For corporate or banking marketing, a classic design is safer.'],
      ['How do I show results without exact numbers?', 'Use percentages and ranges, for example "grew Instagram followers from 2,000 to 15,000".'],
      ['Is it free?', 'Yes. Edit and download as a PDF without a watermark.'],
    ],
  }),
  job({
    slug: 'graphic-designer-resume', short: 'Graphic designer resume', chip: 'Designer', feature: ['resume-modern', ...byPerson(PERSON.designer)],
    title: 'Graphic Designer Resume Template - Free Creative CV, PDF',
    desc: 'Free graphic designer and UI/UX designer resume templates with a creative touch. Add your portfolio and tools and download your resume as a PDF.',
    h1: 'Graphic Designer Resume Template',
    lede: 'Creative resume templates for graphic designers, UI/UX and product designers. Add your portfolio link, tools and best projects, and download a PDF.',
    sections: [
      ['Your resume is a design sample', '<p>For designers, the resume itself shows your taste. Pick a layout, then adjust colours and fonts to match your personal brand, and keep plenty of white space. Put your portfolio link (Behance, Dribbble or your own site) next to your name: it is the first thing a studio will click.</p>'],
      ['Design skills to include', skillsList(['Adobe Illustrator, Photoshop', 'InDesign', 'Figma, Sketch, Adobe XD', 'Brand identity', 'Typography', 'UI and UX design', 'Packaging design', 'Motion graphics', 'Print production'])],
    ],
    faq: [
      ['Can I change the colours and fonts?', 'Yes. Every colour, font and shape can be changed, and more than 150 fonts are available.'],
      ['Should I add images of my work?', 'Keep the resume itself to text and a link; send your portfolio separately. A small logo or icon is fine.'],
      ['Is it free?', 'Yes, with no watermark.'],
    ],
  }),
  job({
    slug: 'data-analyst-resume', short: 'Data analyst resume', chip: 'Data analyst', feature: byPerson(PERSON.data),
    title: 'Data Analyst Resume Template - Free, Edit and Download PDF',
    desc: 'Free data analyst and data scientist resume templates with SQL, Python and Power BI examples. Edit online and download your resume as a PDF.',
    h1: 'Data Analyst Resume Template',
    lede: 'Resume templates for data analysts, BI analysts and data scientists, filled in with real tools and results. Add your own projects and download a PDF.',
    sections: [
      ['How to write a data analyst resume', '<p>Show the question, the tool and the outcome: <em>"Built Power BI dashboards used by 200 managers"</em> or <em>"Automated reports in Python, saving 15 hours a week"</em>. List SQL, Python or R, and your BI tool at the top. A Projects section with Kaggle, GitHub or portfolio links helps if you are changing careers.</p>'],
      ['Data skills to include', skillsList(['SQL', 'Python (pandas, NumPy)', 'R', 'Power BI, Tableau, Looker', 'Excel, VBA', 'Statistics, A/B testing', 'Data cleaning', 'Machine learning basics', 'Data storytelling'])],
    ],
    faq: [
      ['Should I include projects?', 'Yes, especially early in your career: two or three projects with a result and a link are often more convincing than course names.'],
      ['Is the PDF readable by ATS?', 'Yes. The text stays real text; for the safest result pick an ATS-friendly design.'],
      ['Is it free?', 'Yes, with no sign-up.'],
    ],
  }),
  job({
    slug: 'manager-resume', short: 'Manager resume', chip: 'Manager', feature: byPerson(PERSON.manager),
    title: 'Manager Resume Template - Free Operations Manager CV',
    desc: 'Free manager resume templates for operations, project and general managers. Show your team size, budgets and results, then download as PDF.',
    h1: 'Manager Resume Template',
    lede: 'Resume templates for operations managers, project managers and team leads, with real leadership results. Replace the sample text and download a professional PDF.',
    sections: [
      ['How to write a manager resume', '<p>Senior employers want scope and results: how many people you led, the budget you owned and what improved under you. <em>"Run a distribution centre with 250 staff; cut shipping errors by 40 percent."</em> Two pages are fine for managers with long careers, as long as the first half page sells you.</p>'],
      ['Management skills to include', skillsList(['Team leadership', 'Budgeting and P&L', 'Project management (PMP)', 'Lean, Six Sigma', 'Process improvement', 'Stakeholder management', 'Hiring and training', 'KPIs and reporting', 'Vendor management'])],
    ],
    faq: [
      ['Can a manager resume be two pages?', 'Yes. Add a second page from the Pages panel and duplicate the section styles so both pages match.'],
      ['Which design looks most senior?', 'The classic, executive header and timeline designs read as most senior.'],
      ['Is it free?', 'Yes, without a watermark.'],
    ],
  }),
  job({
    slug: 'fresher-resume', short: 'Resume for freshers', chip: 'Fresher', feature: byPerson(PERSON.fresher),
    kicker: 'Resume with no experience',
    title: 'Resume for Freshers - Free Student and First Job Templates',
    desc: 'Free resume templates for freshers, students and graduates with no experience. Show your degree, internships and skills and download a PDF.',
    h1: 'Resume Templates for Freshers',
    lede: 'No work experience yet? These resume templates for students and fresh graduates put your education, internships, projects and activities first. Edit one and download a PDF.',
    sections: [
      ['What to write with no experience', '<ol><li><strong>Profile:</strong> two lines on what you studied and the job you want.</li><li><strong>Education first:</strong> degree, university, year and your CGPA or grade if it is good.</li><li><strong>Internships and projects:</strong> what you did and one result each, even for short internships.</li><li><strong>Activities:</strong> societies, events you organised, volunteering, sports: they show teamwork and leadership.</li><li><strong>Skills:</strong> MS Office, languages and anything from the job advert you can really do.</li></ol>'],
      ['Freshers: common mistakes', '<p>Do not pad the page with long objectives or hobbies; one page is perfect. Use a professional email address (firstname.lastname@...). Check spelling twice and send a PDF so the layout stays the same on the recruiter\'s computer.</p>'],
    ],
    faq: [
      ['How do I make a resume with no experience?', 'Lead with education, then internships, projects and activities. Use action words such as organised, built, led and improved, and keep it to one page.'],
      ['Should a fresher add CGPA?', 'Yes if it is 3.0 out of 4 (or 70 percent) or higher; otherwise leave it out and highlight projects.'],
      ['Is this resume builder free for students?', 'Yes, completely free, with no sign-up and no watermark.'],
    ],
  }),

  // ----------------------------------------------------------------- styles --
  {
    slug: 'cv-maker', kind: 'resume', cat: 'resume', only: 'resume', style: 'classic', short: 'CV maker',
    title: 'Free CV Maker - CV Templates and CV Format, Download PDF',
    desc: 'Free CV maker with professional CV templates and the right CV format. Fill in your details online and download your curriculum vitae as a PDF.',
    kicker: 'Free CV builder', h1: 'Free CV Maker',
    lede: 'Make a professional CV online: choose a CV template, fill in your education, experience and skills, and download a PDF ready to email or print.',
    panel: ['CV templates', 'Classic designs first, then every other style. Click one to open it.'],
    sections: [
      ['The right CV format', '<ol><li><strong>Personal details:</strong> name, phone, email, city and LinkedIn. Add a photo, date of birth and nationality only where it is expected (Pakistan, the Gulf, parts of Europe).</li><li><strong>Profile:</strong> two or three lines about who you are and what you want.</li><li><strong>Work experience:</strong> newest first, with employer, dates and achievements.</li><li><strong>Education:</strong> degrees with institution and year.</li><li><strong>Skills, languages and certifications.</strong></li><li><strong>References:</strong> "Available on request" is enough.</li></ol>'],
      ['CV or resume?', '<p>In the UK, Pakistan, India and the Gulf, "CV" usually means the same as a resume: a one or two-page summary of your career. For academic jobs a CV is longer and lists publications and research. Read <a href="/guides/resume-vs-cv">resume vs CV</a> for the details.</p>'],
    ],
    faq: [
      ['Is this CV maker free?', 'Yes. Make, edit and download your CV as a PDF free of charge, without a watermark or sign-up.'],
      ['Can I make a CV in Urdu?', 'Yes. Type Urdu and choose an Urdu font such as Noto Naskh Arabic; the text is joined correctly in the PDF.'],
      ['Can I make a biodata?', 'Yes. Add personal details (date of birth, nationality, marital status) to any template and change the title to Biodata.'],
      ['How do I send my CV?', 'Download the PDF and attach it to your email or upload it to the job site. Name it firstname-lastname-cv.pdf.'],
    ],
  },
  {
    slug: 'ats-resume-template', kind: 'resume', cat: 'resume', only: 'resume', style: 'ats', short: 'ATS resume template',
    title: 'ATS-Friendly Resume Template - Free, Simple, Download PDF',
    desc: 'Free ATS-friendly resume templates that applicant tracking systems can read. Simple layout, standard headings and real text. Download as PDF.',
    kicker: 'Pass the resume scanners', h1: 'ATS-Friendly Resume Templates',
    lede: 'Plain, one-column resume templates that applicant tracking systems read without trouble. Fill one in, match the keywords to the job advert, and download a PDF.',
    panel: ['ATS-friendly resume templates', 'Simple one-column designs first, then every other style.'],
    sections: [
      ['What makes a resume ATS-friendly', '<ul><li>One column, standard section names: Summary, Work Experience, Education, Skills.</li><li>Real text, not text inside pictures; standard fonts such as Helvetica, Times or Roboto.</li><li>No tables or text boxes for important details, and contact details in the main text.</li><li>The same words the job advert uses for skills and job titles.</li><li>A PDF or Word file; these templates download as PDF with real, selectable text.</li></ul>'],
      ['Check your keywords', '<p>Copy the job advert and underline the skills and tools it mentions. Each one you really have should appear in your Skills section and, ideally, in a job line too. Read the <a href="/guides/ats-friendly-resume">ATS resume guide</a> for more.</p>'],
    ],
    faq: [
      ['Are PDF resumes ATS-friendly?', 'Yes, if the PDF contains real text, as these do. Avoid scanned or image-only PDFs.'],
      ['Can a colourful resume pass ATS?', 'Often yes, if it is one or two clear columns with real text. When in doubt, use one of the ATS designs.'],
      ['Is it free?', 'Yes, with no watermark.'],
    ],
  },
  {
    slug: 'modern-resume-template', kind: 'resume', cat: 'resume', only: 'resume', style: 'modern', short: 'Modern resume template',
    title: 'Modern Resume Templates - Free, Editable, PDF Download',
    desc: 'Free modern resume templates with clean layouts, sidebars and colour accents. Edit online in minutes and download your modern resume as a PDF.',
    kicker: 'Clean and current', h1: 'Modern Resume Templates',
    lede: 'Clean, current resume designs with sidebars, colour accents and clear headings. Pick one, change the colours to your taste, and download a PDF.',
    panel: ['Modern resume templates', 'Modern designs first, then every other style.'],
    sections: [
      ['Make a modern resume your own', '<p>Change the accent colour to match the company or your personal brand: click a coloured shape and pick a new colour. Swap fonts from the bar above the page. Keep to two fonts and one accent colour so it still looks professional.</p>'],
      ['When to choose a modern design', '<p>Modern designs suit tech, marketing, design, startups and most private companies. For banks, law firms and government jobs, a <a href="/professional-resume-template">professional classic design</a> is safer.</p>'],
    ],
    faq: [
      ['Are modern resumes ATS-friendly?', 'Most are, because the text is real text. Two-column designs can occasionally confuse old systems; use an ATS design if the company uses one.'],
      ['Can I remove the photo circle?', 'Yes. Click it and press Delete, or put your photo in it with Image.'],
      ['Is it free?', 'Yes.'],
    ],
  },
  {
    slug: 'professional-resume-template', kind: 'resume', cat: 'resume', only: 'resume', style: 'classic', short: 'Professional resume template',
    title: 'Professional Resume Templates - Free Classic CV, PDF Download',
    desc: 'Free professional and classic resume templates for corporate, banking and government jobs. Edit online and download your resume as a PDF.',
    kicker: 'Classic and professional', h1: 'Professional Resume Templates',
    lede: 'Classic, professional resume designs that suit banks, law firms, government jobs and senior roles. Fill one in and download a polished PDF.',
    panel: ['Professional resume templates', 'Classic designs first, then every other style.'],
    sections: [
      ['Why classic still works', '<p>Traditional employers read hundreds of resumes and trust a familiar layout: name at the top, clear headings, a serif or clean sans-serif font and no distractions. That lets your experience do the talking.</p>'],
      ['Tips for a professional look', '<ul><li>Use one font family and black or dark grey text.</li><li>Align dates on the right so they are easy to scan.</li><li>Keep margins of at least 40 points.</li><li>Use the same tense: past for old jobs, present for your current one.</li></ul>'],
    ],
    faq: [
      ['Which template is best for government jobs?', 'A classic or ATS design. Add your personal details if the job advert asks for them.'],
      ['Is it free?', 'Yes, with no sign-up or watermark.'],
    ],
  },
  {
    slug: 'simple-resume-template', kind: 'resume', cat: 'resume', only: 'resume', style: 'simple', short: 'Simple resume template',
    title: 'Simple Resume Templates - Free Basic Resume, PDF Download',
    desc: 'Free simple and basic resume templates: clean, minimal and easy to fill in. Edit online, or start from a blank resume, and download as PDF.',
    kicker: 'Simple and minimal', h1: 'Simple Resume Templates',
    lede: 'Basic, minimal resume templates that are quick to fill in and easy to read. Start from one, or from a blank resume, and download a PDF.',
    panel: ['Simple resume templates', 'Minimal designs first, then every other style.'],
    sections: [
      ['A simple resume in 15 minutes', '<ol><li>Pick a simple design or click Start a blank resume.</li><li>Click each line and type your own details.</li><li>Delete sections you do not need with the Delete key.</li><li>Download the PDF.</li></ol>'],
      ['Simple does not mean weak', '<p>Recruiters spend seconds on each resume. A simple layout with strong job lines and clear numbers often beats a busy design. Use the space you save for one more achievement.</p>'],
    ],
    faq: [
      ['What is the simplest resume format?', 'Name and contact details, a short profile, work experience, education and skills, in one column.'],
      ['Can I print it?', 'Yes. Download the PDF and print it on A4 paper.'],
      ['Is it free?', 'Yes.'],
    ],
  },
  {
    slug: 'creative-resume-template', kind: 'resume', cat: 'resume', only: 'resume', style: 'creative', short: 'Creative resume template',
    title: 'Creative Resume Templates - Free, Colourful, PDF Download',
    desc: 'Free creative resume templates with colour, skill bars and bold layouts that stand out. Edit online and download your creative resume as PDF.',
    kicker: 'Stand out', h1: 'Creative Resume Templates',
    lede: 'Colourful resume designs with skill bars, initials badges and bold headings, for jobs where personality counts. Pick one, change the colours and download a PDF.',
    panel: ['Creative resume templates', 'Creative designs first, then every other style.'],
    sections: [
      ['Who should use a creative resume', '<p>Designers, marketers, social media managers, teachers, content creators and startup roles. If you apply to a bank or a large corporation through an online form, a <a href="/ats-resume-template">simple ATS design</a> is the safer choice.</p>'],
      ['Change the colours', '<p>Click any coloured shape or line and pick a new colour from the bar above the page. Skill bars are rectangles: drag the end of the coloured bar to show your level.</p>'],
    ],
    faq: [
      ['Do creative resumes work with ATS?', 'The text is real text, so most systems read it, but bold layouts can confuse old systems. Keep a simple version too.'],
      ['Is it free?', 'Yes, without a watermark.'],
    ],
  },
];
