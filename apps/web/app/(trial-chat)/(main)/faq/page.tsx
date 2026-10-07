"use client";

import { useState } from "react";
import Link from "next/link";

type FaqItem = {
  question: string;
  answer: string;
};

type FaqSection = {
  heading: string;
  items: FaqItem[];
};

const FAQ_SECTIONS: FaqSection[] = [
  {
    heading: "About Alzheimer's Disease",
    items: [
      {
        question: "1. What is Alzheimer's disease?",
        answer:
          "Alzheimer's disease is a progressive brain disorder that gradually affects memory, thinking, reasoning, and the ability to carry out everyday activities. Symptoms typically worsen over time and can eventually impact a person's independence. Alzheimer's disease is the most common form of dementia.",
      },
      {
        question: "2. What are the early signs and symptoms of Alzheimer's disease?",
        answer:
          "Early signs often include memory loss that disrupts daily life, difficulty finding words, confusion with time or place, challenges completing familiar tasks, and changes in judgment, mood, or behavior. While occasional forgetfulness can be a normal part of aging, Alzheimer's-related memory problems are more severe and interfere with everyday functioning.",
      },
      {
        question: "3. How is Alzheimer's disease diagnosed?",
        answer:
          "There is no single test for Alzheimer's disease. Healthcare providers use a combination of medical history, cognitive assessments, physical exams, laboratory tests, brain imaging, and information from family members or caregivers to determine a diagnosis. Early diagnosis can help individuals access treatment options, plan for the future, and explore research opportunities.",
      },
      {
        question: "4. What treatments are available for Alzheimer's disease?",
        answer:
          "Although there is currently no cure for Alzheimer's disease, several treatments can help manage symptoms, and some therapies may help slow disease progression in certain individuals. Researchers continue to study new medications, diagnostic tools, lifestyle interventions, and caregiving approaches to improve outcomes for people living with Alzheimer's disease.",
      },
      {
        question: "5. How can caregivers support someone living with Alzheimer's disease?",
        answer:
          "Caregivers play an important role in helping with daily activities, medical appointments, communication, and safety. Learning about the disease, establishing routines, seeking support from family and community resources, and taking time for self-care can help caregivers manage the challenges of caregiving while supporting their loved one's quality of life.",
      },
    ],
  },
  {
    heading: "About Research Participation",
    items: [
      {
        question: "6. What is a clinical trial?",
        answer:
          "A clinical trial is a type of research study that evaluates new ways to prevent, diagnose, treat, or manage diseases. Clinical trials are an important care option that may provide access to new treatments, therapies, or approaches that are not yet widely available. Participation is voluntary, and every study follows strict safety and ethical guidelines to protect participants. By joining a clinical trial, you can help advance research while exploring additional care options for yourself or your loved one.",
      },
      {
        question: "7. How do I know if I or my loved one may qualify for a research study?",
        answer:
          "Every study has specific eligibility requirements. These may include factors such as age, diagnosis, stage of disease, medications, medical history, or the availability of a caregiver or study partner. A research coordinator will review these requirements and determine whether a study may be a good fit.",
      },
      {
        question: "8. What are the potential benefits and risks of participating in research?",
        answer:
          "Participation may provide access to new treatments, additional health evaluations, or opportunities to contribute to future Alzheimer's discoveries. However, research studies may also involve risks such as side effects, time commitments, travel requirements, or procedures that may be uncomfortable. The study team will explain all potential risks and benefits before participation.",
      },
      {
        question: "9. Will participating in a study cost anything, and is compensation available?",
        answer:
          "Many research studies provide study-related procedures at no cost and may offer reimbursement for travel expenses or compensation for time and participation. Because every study is different, the research team can explain any costs, reimbursements, or compensation available for a specific study.",
      },
      {
        question: "10. Can a caregiver participate alongside the patient?",
        answer:
          "Yes. Many Alzheimer's research studies require a caregiver or study partner who knows the participant well. Caregivers may attend study visits, provide information about changes in memory and daily functioning, help with study activities, and support participation throughout the study.",
      },
    ],
  },
];

function FaqAccordionItem({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-sm transition hover:border-blue-300 dark:hover:border-blue-500/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {item.question}
        </span>
        <svg
          className={`h-4 w-4 flex-shrink-0 text-slate-500 dark:text-slate-400 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {item.answer}
        </div>
      )}
    </div>
  );
}

export default function FaqPage() {
  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar scroll-mask">
      <div className="mx-auto max-w-4xl px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <Link
            href="/"
            className="mb-4 inline-flex items-center text-sm text-slate-600 transition hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
          >
            <svg
              className="mr-2 h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Home
          </Link>
          <h1 className="mb-2 text-4xl font-bold text-slate-800 dark:text-white">
            Frequently Asked Questions
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300">
            Answers to common questions about Alzheimer&apos;s disease and participating in research studies
          </p>
        </div>

        {/* Sections */}
        <div className="flex flex-col gap-10">
          {FAQ_SECTIONS.map((section) => (
            <div key={section.heading}>
              <h2 className="mb-4 text-xl font-bold text-slate-800 dark:text-white">
                {section.heading}
              </h2>
              <div className="flex flex-col gap-3">
                {section.items.map((item) => (
                  <FaqAccordionItem key={item.question} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 border-t border-slate-200 pt-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Developed by S-3 Research LLC
        </div>
      </div>
    </div>
  );
}
