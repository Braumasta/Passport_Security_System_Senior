import { Container } from 'react-bootstrap'

const LegalNoticePage = () => (
  <div className="ps-page-shell py-5">
    <Container>
      <div className="bg-white rounded shadow-sm p-4 p-lg-5">
        <h1 className="mb-4" style={{ color: 'var(--ps-primary)' }}>
          Legal Notice
        </h1>

        <section className="mb-4">
          <h2 className="h5 mb-2">Purpose of This System</h2>
          <p className="text-muted mb-0">
            Passport Security provides digital tools for account verification, passport application intake,
            document submission, and application status review. Information shown in this system is provided
            for service access and administrative processing.
          </p>
        </section>

        <section className="mb-4">
          <h2 className="h5 mb-2">User Responsibilities</h2>
          <p className="text-muted mb-0">
            Users are responsible for submitting accurate, current, and complete information. False,
            incomplete, or misleading submissions may delay processing or result in rejection of an
            application.
          </p>
        </section>

        <section className="mb-4">
          <h2 className="h5 mb-2">Data Handling</h2>
          <p className="text-muted mb-0">
            Personal information and uploaded documents are used only for identity verification, account
            security, application review, and service administration. Access should be limited to authorized
            personnel and protected by appropriate technical and organizational safeguards.
          </p>
        </section>

        <section className="mb-4">
          <h2 className="h5 mb-2">Availability and Accuracy</h2>
          <p className="text-muted mb-0">
            Passport Security works to keep the system available and accurate, but service interruptions,
            maintenance windows, or data-entry errors may occur. The system may be updated without prior
            notice to improve security, reliability, or service quality.
          </p>
        </section>

        <section>
          <h2 className="h5 mb-2">Limitation of Liability</h2>
          <p className="text-muted mb-0">
            Use of this system is subject to applicable rules, review procedures, and administrative
            decisions. Passport Security is not responsible for delays caused by inaccurate submissions,
            missing documents, network issues, or unauthorized use of an account.
          </p>
        </section>
      </div>
    </Container>
  </div>
)

export default LegalNoticePage
