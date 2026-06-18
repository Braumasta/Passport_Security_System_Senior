import { Link } from 'react-router-dom'
import { Container, Row, Col, Card } from 'react-bootstrap'
import './HomePage.css'

const HomePage = ({ currentUser }) => {
  const isAccountVerificationApproved =
    currentUser?.verification_status === 'verified' || currentUser?.verification_status === 'approved'
  const canAccessOperations = ['admin', 'officer'].includes(currentUser?.role)

  const workflowItems = [
    {
      title: 'Submit an Application',
      description: 'Complete the passport request form, upload required documents, and send the file for review.',
      path: '/passport-application',
      action: 'Start request',
      hidden: currentUser?.role === 'admin',
    },
    {
      title: 'Track Applications',
      description: 'View submitted applications, document status, review decisions, and officer updates.',
      path: '/operations',
      action: 'Open applications',
      hidden: !canAccessOperations,
    },
    {
      title: 'Account Verification',
      description: 'Keep your profile ready for review with verified identity details and current contact information.',
      path: '/account',
      action: 'View account',
      hidden: isAccountVerificationApproved,
    },
  ].filter((item) => !item.hidden)

  const readinessItems = [
    'Verified account details',
    'Clear identity document uploads',
    'Current contact information',
    'Application type selected correctly',
  ]

  return (
    <div className="ps-homepage ps-page-shell py-5">
      <Container>
        <div className="ps-homepage-hero text-center mb-5">
          <div className="ps-homepage-kicker">Secure application portal</div>
          <h1 className="display-5 fw-bold mb-3">Passport Security</h1>
          <p className="lead text-muted mb-0">
            Submit passport requests, verify applicant accounts, and follow application progress from one place.
          </p>
        </div>

        {!currentUser && (
          <Row className="justify-content-center mb-4">
            <Col lg={8}>
              <div className="ps-homepage-account-panel d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
                <div>
                  <strong>Account access</strong>
                  <div className="small mt-1 text-muted">
                    Use the login page or create a new applicant account before submitting a passport application.
                  </div>
                </div>
                <div className="ps-homepage-account-actions d-flex gap-2">
                  <Link to="/login" className="btn btn-sm ps-homepage-account-primary">
                    Sign in
                  </Link>
                  <Link to="/register" className="btn btn-sm ps-homepage-account-secondary">
                    Create Account
                  </Link>
                </div>
              </div>
            </Col>
          </Row>
        )}

        <Row className="g-4 mb-5 justify-content-center">
          {workflowItems.map((service) => (
            <Col key={service.path} md={6} lg={4}>
              <Card className="ps-homepage-workflow-card h-100 border-0 shadow-sm">
                <Card.Body>
                  <Card.Title>{service.title}</Card.Title>
                  <Card.Text className="text-muted small">{service.description}</Card.Text>
                  <Link to={service.path} className="btn btn-sm ps-homepage-workflow-link">
                    {service.action}
                  </Link>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>

        <Row className="justify-content-center mb-4">
          <Col lg={10}>
            <div className="ps-homepage-service-panel">
              <div>
                <h2 className="h4 mb-2">Review-ready service flow</h2>
                <p className="text-muted mb-0">
                  The system keeps applicant identity, uploaded documents, and request history connected so officers can review each file with clear context.
                </p>
              </div>
              <div className="ps-homepage-service-stats">
                <div>
                  <span>1</span>
                  Account setup
                </div>
                <div>
                  <span>2</span>
                  Document upload
                </div>
                <div>
                  <span>3</span>
                  Application review
                </div>
              </div>
            </div>
          </Col>
        </Row>

        <Row className="g-4 justify-content-center">
          <Col lg={5}>
            <div className="ps-homepage-readiness-panel">
              <h2 className="h5 mb-3">Before you submit</h2>
              <ul className="list-unstyled mb-0">
                {readinessItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </Col>
          <Col lg={5}>
            <div className="ps-homepage-review-panel">
              <h2 className="h5 mb-3">Application states</h2>
              <div className="ps-homepage-review-list">
                <span>Pending review</span>
                <span>Documents checked</span>
                <span>Decision recorded</span>
              </div>
              <p className="text-muted small mb-0">
                Each request keeps a clear status trail so applicants and officers can follow the same record.
              </p>
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  )
}

export default HomePage
