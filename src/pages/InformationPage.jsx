import { Link, Navigate, useParams } from 'react-router-dom'
import { Container } from 'react-bootstrap'
import './InformationPage.css'

const pages = {
  functions: {
    title: 'Functions of Passport Security',
    summary:
      'Passport Security manages travel-document services, entry procedures, residency-related review, and document-control workflows.',
    sections: [
      {
        heading: 'Core responsibilities',
        items: [
          'Review passport, travel-document, and entry-service requests.',
          'Maintain records connected to issued documents and submitted applications.',
          'Support identity checks, document validation, and application follow-up.',
          'Coordinate service counters and public-facing administrative procedures.',
        ],
      },
      {
        heading: 'Service approach',
        items: [
          'Applicants should submit complete, accurate information.',
          'Original documents may be requested during review.',
          'Applications can be delayed when required documents are missing or inconsistent.',
        ],
      },
    ],
  },
  'code-of-conduct': {
    title: 'Code of Conduct',
    summary:
      'Passport Security services are handled through clear procedures, respectful communication, and responsible use of applicant information.',
    sections: [
      {
        heading: 'Service standards',
        items: [
          'Applicants should be treated with professionalism and without unnecessary delay.',
          'Requests should be reviewed according to published requirements and documented procedures.',
          'Staff should provide clear instructions when information or documents are missing.',
        ],
      },
      {
        heading: 'Applicant expectations',
        items: [
          'Submit accurate information and authentic documents.',
          'Follow appointment, attendance, and document-submission instructions.',
          'Do not offer, request, or accept improper advantages during any service process.',
        ],
      },
    ],
  },
  'office-hours': {
    title: 'Office Hours',
    summary:
      'Service counters operate during published working hours, with some procedures limited to specific service windows.',
    sections: [
      {
        heading: 'Before visiting',
        items: [
          'Check the required documents before going to a service counter.',
          'Bring the original documents and clear copies when the procedure requires them.',
          'Some requests may require the applicant to appear personally.',
        ],
      },
      {
        heading: 'Processing notes',
        items: [
          'Urgent and same-day services may require additional review and fees.',
          'Collection times can differ from submission times.',
          'Holiday schedules and administrative closures may affect availability.',
        ],
      },
    ],
  },
  'contact-us': {
    title: 'Contact Us',
    summary:
      'Use the contact channel for service questions, account support, application follow-up, and document-submission issues.',
    sections: [
      {
        heading: 'What to include',
        items: [
          'Your full name and account email.',
          'Your application reference, if one has already been issued.',
          'A concise description of the issue or question.',
        ],
      },
      {
        heading: 'Do not send',
        items: [
          'Passwords or reset codes.',
          'Unrequested copies of sensitive documents.',
          'Multiple duplicate messages for the same application.',
        ],
      },
    ],
  },
  'visa-types': {
    title: 'Types Of Visas',
    summary:
      'Visa services are organized by travel purpose, stay duration, applicant category, and the issuing channel used for review.',
    sections: [
      {
        heading: 'Common categories',
        items: [
          'Tourism or short-stay visit.',
          'Business, professional, or event-related visit.',
          'Family visit or private invitation.',
          'Transit or onward travel.',
        ],
      },
      {
        heading: 'Review factors',
        items: [
          'Passport validity and identity information.',
          'Purpose of travel and supporting documents.',
          'Prior entries, permits, or administrative restrictions.',
        ],
      },
    ],
  },
  'embassy-visa': {
    title: 'Visa granted by the embassy',
    summary:
      'Some applicants must obtain an entry visa through a diplomatic or consular office before travel.',
    sections: [
      {
        heading: 'Typical requirements',
        items: [
          'A valid passport or travel document.',
          'A completed visa request form.',
          'Recent personal photo matching the required format.',
          'Supporting documents that explain the purpose of travel.',
        ],
      },
      {
        heading: 'After submission',
        items: [
          'The request may be reviewed by more than one office.',
          'Additional documents may be requested.',
          'Approval is not guaranteed until the visa is issued.',
        ],
      },
    ],
  },
  'visa-terms': {
    title: 'Visa terms and conditions',
    summary:
      'Visa approval depends on identity verification, travel purpose, supporting documents, and compliance with entry rules.',
    sections: [
      {
        heading: 'Applicant obligations',
        items: [
          'Provide accurate personal and travel information.',
          'Respect the permitted stay period and visa conditions.',
          'Carry supporting documents when requested by officers.',
        ],
      },
      {
        heading: 'Possible refusal reasons',
        items: [
          'Incomplete documentation.',
          'Inconsistent travel purpose.',
          'Invalid passport details or unresolved administrative restrictions.',
        ],
      },
    ],
  },
  'biometric-passport': {
    title: 'Biometric passport',
    summary:
      'A biometric passport application normally requires a completed form, identity documents, a compliant photo, and the old passport when available.',
    sections: [
      {
        heading: 'Required documents',
        items: [
          'Completed passport application form.',
          'National identity document or civil-status extract.',
          'Recent color photo on a white background.',
          'Previous passport when applying for renewal.',
        ],
      },
      {
        heading: 'Important notes',
        items: [
          'Minors require guardian approval according to the applicable procedure.',
          'Copies should be clear and sized according to the requested format.',
          'The applicant may be asked to appear personally for verification.',
        ],
      },
    ],
  },
  'lost-stolen-passport': {
    title: 'Lost Passport / Stolen Passport',
    summary:
      'A lost or stolen passport should be declared even when the applicant does not immediately request a replacement.',
    sections: [
      {
        heading: 'What to prepare',
        items: [
          'A declaration explaining the loss or theft.',
          'Identity documents and any available copy of the previous passport.',
          'A replacement request if a new passport is needed.',
        ],
      },
      {
        heading: 'Review process',
        items: [
          'The previous passport may be marked as invalid.',
          'Additional checks can be required before a replacement is approved.',
          'A police report or supporting document may be requested depending on the case.',
        ],
      },
    ],
  },
  'passport-picture-requirements': {
    title: 'Passport picture requirements',
    summary:
      'Passport photos must clearly show the applicant and meet size, background, and quality requirements.',
    sections: [
      {
        heading: 'Photo format',
        items: [
          'Recent color photo.',
          'Plain white background.',
          'Clear front-facing view with natural expression.',
          'No shadows, heavy filters, or obstructed facial features.',
        ],
      },
      {
        heading: 'Submission quality',
        items: [
          'The photo should not be blurry, damaged, or low contrast.',
          'Head coverings or accessories must not hide identifying features unless permitted by rule.',
          'The printed or uploaded image should match the requested dimensions.',
        ],
      },
    ],
  },
  'retrieving-archived-passports': {
    title: 'Retrieving archived passports',
    summary:
      'Archived passports may be retrieved during service hours when the applicant meets the collection requirements.',
    sections: [
      {
        heading: 'Collection requirements',
        items: [
          'Applicant identity must be verified before retrieval.',
          'A receipt, reference, or supporting document may be required.',
          'Minors may need guardian involvement according to the applicable procedure.',
        ],
      },
      {
        heading: 'Processing notes',
        items: [
          'Archived records can require additional lookup time.',
          'Documents are released only after the responsible office confirms eligibility.',
          'Collection may be limited to specific counters or service windows.',
        ],
      },
    ],
  },
  'personal-attendance': {
    title: 'Personal attendance required',
    summary:
      'Some passport procedures require the applicant to appear personally for identity confirmation or signature.',
    sections: [
      {
        heading: 'When attendance is needed',
        items: [
          'First-time biometric passport requests.',
          'Cases that require signature, identity confirmation, or guardian approval.',
          'Applications with missing, inconsistent, or sensitive information.',
        ],
      },
      {
        heading: 'Exceptions and notes',
        items: [
          'Young minors may follow a different attendance process.',
          'Guardian authorization may be required for applicants under the applicable age threshold.',
          'The reviewing office can request attendance when needed to complete the file.',
        ],
      },
    ],
  },
}

const InformationPage = () => {
  const { slug } = useParams()
  const page = pages[slug]

  if (!page) {
    return <Navigate to="/information/biometric-passport" replace />
  }

  return (
    <div className="ps-page-shell py-5">
      <Container>
        <div className="bg-white rounded shadow-sm p-4 p-lg-5">
          <div className="mb-4">
            <Link to="/" className="ps-information-back-link text-decoration-none">
              <span aria-hidden="true">&lt;</span>
              Back to homepage
            </Link>
          </div>
          <h1 className="mb-3" style={{ color: 'var(--ps-primary)' }}>
            {page.title}
          </h1>
          <p className="lead text-muted mb-4">{page.summary}</p>

          {page.sections.map((section) => (
            <section key={section.heading} className="mb-4">
              <h2 className="h5 mb-3">{section.heading}</h2>
              <ul className="mb-0">
                {section.items.map((item) => (
                  <li key={item} className="mb-2 text-muted">
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Container>
    </div>
  )
}

export default InformationPage
