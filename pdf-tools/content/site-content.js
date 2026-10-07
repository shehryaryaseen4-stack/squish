'use strict';

/*
 * Site-level copy. Plain text only.
 * Placeholders: {site} = site name, {email} = contact email.
 * Any paragraph containing {email} may be dropped by the renderer when no
 * email is configured, so {email} always sits in its own paragraph.
 * Note: this is not legal advice. The site operator should review these
 * policies before publishing.
 */

const homeFaqs = [
  {
    q: "Is {site} really free? What's the catch?",
    a: "Yes, every tool is completely free. There are no subscriptions, no premium tier, no payments and no watermarks added to your results. The site is funded by advertising, so you may see ads on some pages. That is how we keep the tools free for everyone.",
  },
  {
    q: "Do I need to create an account?",
    a: "No. There is no account and no sign-up. Open a tool, choose your file and download the result.",
  },
  {
    q: "Are my files safe?",
    a: "Many tools run entirely in your browser, so your file never leaves your device. Tools that need our server upload one file over an encrypted HTTPS connection, process it in a private temporary folder and delete both the upload and the result as soon as the download is sent. Any leftovers are removed automatically within one hour. We do not store, share or look at your files, and we do not use them for training.",
  },
  {
    q: "Which tools work in my browser without uploading?",
    a: "Merging, splitting, page tools (extract, delete, rearrange, rotate, duplicate), PDF to JPG, PNG or text, JPG or PNG to PDF, the editor tools (edit, add text, add image, shapes, sign, highlight, annotate), watermark, redact, page numbers, the metadata editor and PDF to ZIP all run on your device. Office conversions, compression, protect and unlock, repair, OCR and image extraction use our server. Each tool page shows a badge that tells you which kind it is.",
  },
  {
    q: "Is there a file size limit?",
    a: "Server tools accept one file of up to 100 MB per request, and a fair-use rate limit helps keep the service available for everyone. In-browser tools have no fixed limit; they are limited only by your device's memory, so very large files may be slow on older phones or computers.",
  },
  {
    q: "Does it work on my phone, Mac, Windows or Linux computer?",
    a: "Yes. {site} runs in any modern web browser, including Chrome, Edge, Firefox and Safari, on Windows, macOS, Linux, Android and iOS. There is nothing to install.",
  },
  {
    q: "Can I edit the existing text in a PDF?",
    a: "Partly. You can add new text anywhere on a page and cover existing content with a white box, then type replacement text on top. What you cannot do is reflow or rewrite the original text the way a word processor would, because PDFs store text as fixed positions on the page. If you need heavy rewriting, try converting the PDF to Word, editing it there and converting it back.",
  },
  {
    q: "Are signatures added with {site} legally binding?",
    a: "The Sign tool places a visual signature, such as a drawn, typed or uploaded image of your signature, onto the page. It is not a certificate-based digital signature. Whether a visual electronic signature is legally valid depends on your jurisdiction and the type of document, so check the requirements that apply to you if it matters.",
  },
];

const privacySummary = [
  {
    title: "Many tools stay local",
    text: "In-browser tools process your file on your own device. The file is never uploaded.",
  },
  {
    title: "Server files deleted immediately",
    text: "Server tools delete your upload and the result right after the download is sent. Any leftovers are removed automatically within one hour.",
  },
  {
    title: "No account required",
    text: "You never need to sign up or give us your name or email to use a tool.",
  },
  {
    title: "Never stored or shared",
    text: "We do not keep, share, sell or look at your files, and we never use them for training.",
  },
];

const about = {
  description:
    "Learn about {site}: free PDF tools with no sign-up, many of which run in your browser so your files stay private. Who we serve and how we stay free.",
  sections: [
    {
      heading: "What {site} is",
      paragraphs: [
        "{site} is a collection of free online tools for working with PDF files. You can merge, split, rotate and rearrange pages, convert PDFs to and from Word, Excel, PowerPoint and images, compress files, add text, images, signatures and watermarks, protect or unlock documents, run OCR on scans and more.",
        "Every tool works directly in your web browser. There is nothing to install and no account to create.",
      ],
    },
    {
      heading: "Who it is for",
      paragraphs: [
        "{site} is built for anyone who needs to get something done with a PDF quickly: students combining lecture notes or submitting assignments, office workers filling in, signing and sending forms, small businesses preparing invoices and contracts, and anyone who just needs to shrink a file so it fits in an email.",
        "We try to keep each tool simple enough to use without instructions, while still giving you the options you need.",
      ],
    },
    {
      heading: "Why it is free",
      paragraphs: [
        "All of the tools are free, with no subscriptions, no premium tier, no payments and no watermarks added to your results. The site is funded by advertising, so ads may be shown on some pages. Ads pay for the servers and development, which lets us keep every feature available to everyone.",
      ],
    },
    {
      heading: "What makes us different",
      paragraphs: [
        "Privacy comes first. Many of our tools, including merge, split, page editing, image conversion, signing, watermarking and redaction, run entirely in your browser. Your file is processed on your own device and never uploaded to us.",
        "Some tasks, such as converting Office documents, compressing files or running OCR, need software that only runs on a server. For those tools, your file is uploaded over HTTPS, processed in a private temporary folder and deleted as soon as the result is sent back to you. Every tool page shows a badge so you always know which kind of tool you are using.",
        "We are honest about limits. We tell you what each tool can and cannot do, such as the fact that PDF text cannot be reflowed like a word processor document, or that a visual signature is not a certified digital signature.",
        "No sign-up, ever. You do not need to give us your name or email address to use any tool.",
      ],
    },
    {
      heading: "The technology behind it",
      paragraphs: [
        "{site} is built on well-established open-source software. In-browser tools use libraries such as pdf-lib and PDF.js to read, render and modify PDFs with JavaScript on your device. Server tools rely on proven engines such as LibreOffice for Office conversions, Ghostscript for compression and optimization, qpdf for encryption, unlocking and repair, and Tesseract for optical character recognition.",
        "We are grateful to the many developers who maintain these projects.",
      ],
    },
    {
      heading: "Get in touch",
      paragraphs: [
        "We welcome bug reports, feature suggestions and questions. Visit our contact page to reach us.",
      ],
    },
  ],
};

const privacy = {
  description:
    "Read the {site} privacy policy: how in-browser and server PDF tools handle your files, what we log, how ads and cookies work, and your rights.",
  updated: '2026-10-07',
  sections: [
    {
      heading: "Overview",
      paragraphs: [
        "This privacy policy explains what information {site} (\"we\", \"us\") collects when you use our website and PDF tools, how we use it and the choices you have. We have designed the service to collect as little as possible. You do not need an account to use any tool, and we never ask for your name or email address to process a file.",
      ],
    },
    {
      heading: "Information we collect",
      paragraphs: [
        "We collect only the information needed to run and protect the service:",
      ],
      list: [
        "Files you choose to process with a server tool, held only temporarily as described below.",
        "Passwords you type into Protect PDF or Unlock PDF, used only for that one operation.",
        "Standard technical data in server logs, such as IP address, browser type, date and time, and the page requested.",
        "Anything you choose to send us when you contact us, such as your email address and message.",
      ],
    },
    {
      heading: "How your files are handled",
      paragraphs: [
        "{site} offers two kinds of tools, and each tool page shows a badge saying which kind it is.",
        "In-browser tools process your file entirely on your own device using JavaScript. The file is never uploaded to our servers, and we never receive or see it. These include merge, split, page tools, PDF to image or text, images to PDF, the editor tools, watermark, redact, page numbers, the metadata editor and PDF to ZIP.",
        "Server tools upload one file over an encrypted HTTPS connection. The file is processed in a private temporary folder on our server, and both the upload and the result are deleted immediately after the result is sent back to you. As a safeguard, an automatic clean-up deletes any leftover files older than one hour, for example after an unexpected crash. These include Office conversions, compression, optimization, protect, unlock, remove restrictions, repair, OCR, image to text and image extraction.",
        "We do not store your files, share them with anyone, use them to train any model or have people look at them. File names and file contents are not written to our logs.",
      ],
    },
    {
      heading: "Passwords",
      paragraphs: [
        "When you use Protect PDF or Unlock PDF, the password you enter is sent together with your file over HTTPS. It is used only to perform that single operation and is never stored or logged.",
      ],
    },
    {
      heading: "Server logs",
      paragraphs: [
        "Like most websites, our servers automatically record standard technical data for each request, such as IP address, browser type, date and time, and the page requested. We use this information only to keep the service secure, prevent abuse, enforce fair-use limits and fix technical problems. Logs are kept for a short time, up to 14 days, and then deleted.",
        "Our hosting and content delivery provider may process traffic to the site in order to deliver it and protect it from attacks. They act on our behalf and only for that purpose.",
      ],
    },
    {
      heading: "Cookies and advertising",
      paragraphs: [
        "{site} itself does not set any cookies and does not use analytics cookies.",
        "The site is funded by advertising. When ads are enabled, they are provided by Google AdSense. Google and its partners may use cookies or similar technologies to show ads, limit how often you see them and measure their performance. Depending on your consent choices and where you are located, ads may be personalized based on your interests or non-personalized. Visitors in the European Economic Area, the United Kingdom and Switzerland are shown a consent message and can choose whether to allow personalized ads.",
        "To learn how Google uses information from websites that show its ads, see \"How Google uses information from sites or apps that use our services\" at https://policies.google.com/technologies/partner-sites. You can manage or turn off personalized ads at any time in Google Ads Settings at https://adssettings.google.com.",
        "For more details, see our Cookie Policy.",
      ],
    },
    {
      heading: "How we use information",
      paragraphs: [
        "We use the limited information we collect to provide the tools you request, keep the service secure and available, prevent abuse, respond to your messages and comply with legal obligations. We do not sell your personal information and we do not build profiles of our visitors.",
      ],
    },
    {
      heading: "Children",
      paragraphs: [
        "{site} is a general-audience service and is not directed at children under 13, or under the minimum age required in your country. We do not knowingly collect personal information from children. If you believe a child has sent us personal information, please contact us and we will delete it.",
      ],
    },
    {
      heading: "Your rights",
      paragraphs: [
        "Depending on where you live, you may have rights over your personal information, including under laws such as the EU and UK General Data Protection Regulation (GDPR) and the California Consumer Privacy Act (CCPA). These may include the right to:",
      ],
      list: [
        "Ask what personal information we hold about you and receive a copy.",
        "Ask us to correct or delete your personal information.",
        "Object to or ask us to restrict certain processing.",
        "Withdraw consent at any time, for example for personalized ads.",
        "Not be discriminated against for exercising your privacy rights.",
        "Lodge a complaint with your local data protection authority.",
      ],
    },
    {
      heading: "Exercising your rights",
      paragraphs: [
        "Because we do not keep your files or require an account, we usually hold very little information that can be linked to you. To make a request, contact us and we will respond within the time required by applicable law. We may need to ask for information to verify your request.",
        "For data collected by Google for advertising, you can also use Google Ads Settings at https://adssettings.google.com.",
      ],
    },
    {
      heading: "Changes to this policy",
      paragraphs: [
        "We may update this policy from time to time, for example when we add new tools or features. When we do, we will change the \"last updated\" date at the top of this page. Please check back occasionally to stay informed.",
      ],
    },
    {
      heading: "Contact",
      paragraphs: [
        "If you have questions about this policy or want to make a privacy request, please get in touch through our contact page.",
        "You can email us at {email}.",
      ],
    },
  ],
};

const terms = {
  description:
    "The terms of use for {site}: a free PDF service provided as-is, acceptable use rules, your responsibility for results, limits on liability and more.",
  updated: '2026-10-07',
  sections: [
    {
      heading: "Agreement to these terms",
      paragraphs: [
        "These terms of use govern your use of the {site} website and its PDF tools (the \"service\"). By using the service, you agree to these terms. If you do not agree, please do not use the service.",
      ],
    },
    {
      heading: "The service",
      paragraphs: [
        "{site} provides free online tools for viewing, editing, converting and otherwise working with PDF files. No account is required and there are no fees. The service is funded by advertising, and ads may be shown on the site.",
        "Some tools run entirely in your browser, and others process your file on our server. How we handle your files is described in our Privacy Policy.",
        "We may add, change, limit or remove tools or features at any time, and we may suspend the service temporarily for maintenance or other reasons, without notice.",
      ],
    },
    {
      heading: "Limits and fair use",
      paragraphs: [
        "To keep the service available for everyone, server tools accept one file per request, up to a maximum size (currently 100 MB), and apply a fair-use rate limit per connection. In-browser tools are limited by your device's memory. We may block or limit access that we reasonably believe is abusive or harms the service.",
      ],
    },
    {
      heading: "Acceptable use",
      paragraphs: [
        "You agree to use the service lawfully and responsibly. In particular, you agree not to:",
      ],
      list: [
        "Upload or process files that you do not own or do not have the right to use, modify or convert.",
        "Process illegal content, or content that infringes the intellectual property, privacy or other rights of others.",
        "Use the service to remove protection from documents you are not authorized to unlock.",
        "Abuse or overload the service, including by sending excessive requests or using bots, scripts or automated scraping.",
        "Attempt to bypass rate limits, file size limits or other security measures, or probe, scan or test the service for vulnerabilities without permission.",
        "Upload malware or any file intended to harm the service or other users.",
        "Interfere with or disrupt the service, its servers or networks.",
      ],
    },
    {
      heading: "Your files and results",
      paragraphs: [
        "You keep all rights to the files you process. We do not claim any ownership of your files or the results.",
        "You are responsible for the files you process and for how you use the results. Conversion, compression, OCR and editing can change formatting, layout, fonts, image quality or text, and results may not always be perfect. Always check converted or edited documents carefully before you rely on them, and keep a copy of your original file.",
        "When you redact content, review the result to make sure all sensitive information has been removed as intended.",
      ],
    },
    {
      heading: "Signatures",
      paragraphs: [
        "The Sign tool adds a visual signature, such as a drawn, typed or image signature, to a PDF. It is not a certified, certificate-based digital signature and does not verify anyone's identity. Whether a visual electronic signature is legally valid depends on your jurisdiction and the type of document. It is your responsibility to determine whether it meets your needs.",
      ],
    },
    {
      heading: "Third-party content and links",
      paragraphs: [
        "The site may show ads and contain links to third-party websites. We are not responsible for the content, products or practices of third parties.",
      ],
    },
    {
      heading: "No warranty",
      paragraphs: [
        "The service is provided free of charge \"as is\" and \"as available\", without warranties of any kind, whether express or implied, including warranties of merchantability, fitness for a particular purpose, accuracy and non-infringement. We do not guarantee that the service will be uninterrupted, error-free or secure, or that any result will meet your requirements.",
      ],
    },
    {
      heading: "Limitation of liability",
      paragraphs: [
        "To the fullest extent permitted by law, {site} and its operators will not be liable for any indirect, incidental, special, consequential or punitive damages, or for any loss of data, documents, profits or business, arising from or related to your use of, or inability to use, the service, even if we have been advised of the possibility of such damages.",
        "Because the service is free, our total liability for any claim related to the service is limited to the maximum extent permitted by law. Some jurisdictions do not allow certain limitations, so some of the above may not apply to you.",
      ],
    },
    {
      heading: "Indemnity",
      paragraphs: [
        "You agree to indemnify and hold harmless {site} and its operators from any claims, damages or expenses arising from your misuse of the service, your violation of these terms or your violation of the rights of others.",
      ],
    },
    {
      heading: "Changes to these terms",
      paragraphs: [
        "We may update these terms from time to time. When we do, we will change the \"last updated\" date at the top of this page. Continuing to use the service after changes take effect means you accept the updated terms.",
      ],
    },
    {
      heading: "Contact",
      paragraphs: [
        "If you have questions about these terms, please get in touch through our contact page.",
        "You can email us at {email}.",
      ],
    },
  ],
};

const cookies = {
  description:
    "The {site} cookie policy: we set no cookies of our own, use no analytics cookies, and explain how advertising cookies work and how you can control them.",
  updated: '2026-10-07',
  sections: [
    {
      heading: "What cookies are",
      paragraphs: [
        "Cookies are small text files that a website or a third-party service saves in your browser. They can be used to remember settings, keep you signed in, measure visits or show and measure ads. Similar technologies, such as your browser's local storage, can store information in a similar way.",
      ],
    },
    {
      heading: "Cookies set by {site}",
      paragraphs: [
        "{site} itself does not set any cookies. We do not use analytics cookies or tracking cookies of our own, and you do not need to accept any cookies to use our tools.",
      ],
    },
    {
      heading: "Local browser storage",
      paragraphs: [
        "When you choose a file on the homepage and then pick a tool, we use your browser's local storage to hand that file over to the tool page in the same browser. The file stays on your device, is not sent to us by this step and is cleared from storage right away once the tool page has picked it up.",
      ],
    },
    {
      heading: "Advertising cookies",
      paragraphs: [
        "The site is funded by advertising. When ads are enabled, they are provided by Google AdSense. Google and its partners may use cookies or similar technologies to show ads, limit how often you see the same ad and measure ad performance. Depending on your consent choices and location, these ads may be personalized based on your interests or non-personalized.",
        "Visitors in the European Economic Area, the United Kingdom and Switzerland are shown a consent message before personalized advertising cookies are used, and can change their choice later.",
        "To learn more, see \"How Google uses information from sites or apps that use our services\" at https://policies.google.com/technologies/partner-sites. You can manage or turn off personalized ads in Google Ads Settings at https://adssettings.google.com.",
      ],
    },
    {
      heading: "How to control cookies",
      paragraphs: [
        "You can control cookies in several ways:",
      ],
      list: [
        "Use the consent message, where shown, to accept or decline personalized ads.",
        "Turn off personalized ads in Google Ads Settings at https://adssettings.google.com.",
        "Change your browser settings to block or delete cookies, including third-party cookies. Your browser's help pages explain how.",
        "Use your browser's private or incognito mode, which clears cookies when you close the window.",
      ],
    },
    {
      heading: "Blocking cookies",
      paragraphs: [
        "Because {site} does not rely on its own cookies, all of our tools continue to work if you block cookies. Blocking advertising cookies may mean you see less relevant ads, but not fewer ads.",
      ],
    },
    {
      heading: "Changes to this policy",
      paragraphs: [
        "We may update this cookie policy from time to time. When we do, we will change the \"last updated\" date at the top of this page.",
      ],
    },
    {
      heading: "Contact",
      paragraphs: [
        "If you have questions about cookies on {site}, please get in touch through our contact page.",
        "You can email us at {email}.",
      ],
    },
  ],
};

const contact = {
  description:
    "Contact the {site} team with questions, bug reports, feature ideas or privacy requests about our free online PDF tools. We read every message we receive.",
  paragraphs: [
    "We would like to hear from you. Whether you found a bug, have an idea for a new tool, have a question about how a tool works or want to make a privacy request, please get in touch.",
    "You can reach us by email at {email}.",
    "We read every message. When reporting a bug, it helps to tell us which tool you used, what browser and device you were on and what happened. Please do not send us confidential documents; describe the problem instead.",
    "For privacy requests, such as questions about your personal information or your rights, please say so in your message so we can handle it promptly.",
    "We do not offer phone support.",
  ],
};

module.exports = {
  homeFaqs,
  privacySummary,
  about,
  privacy,
  terms,
  cookies,
  contact,
};
