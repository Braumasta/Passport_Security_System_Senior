import { Link } from 'react-router-dom'
import { Container, Row, Col, Form, Button } from 'react-bootstrap'

const ContactPage = () => {
  return (
    <div className="ps-contact-page ps-page-shell py-5">
      <Container>
        <div className="bg-white rounded shadow-sm p-4 p-lg-5">
          <h1 className="mb-4" style={{ color: 'var(--ps-primary)' }}>
            Contact Us
          </h1>
          <Row>
            <Col lg={6}>
              <h2 className="h5 mb-3">1234 - Contact Line</h2>
              <p className="text-muted">
                For general inquiries and support, please call our contact line at <strong>1234</strong>.
              </p>

              <h2 className="h5 mb-3 mt-4">Office Hours</h2>
              <p className="text-muted">
                Please refer to our <Link to="/posts/178">Office hours</Link> page for detailed information about our service schedules.
              </p>

              <h2 className="h5 mb-3 mt-4">Central Direction</h2>
              <p className="mb-0">
                <strong>Adliyeh - Sami el Soleh street</strong><br />
                01/386610 - 01/425610
              </p>
            </Col>
            <Col lg={6}>
              <h2 className="h5 mb-3">Send a Message</h2>
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>Name</Form.Label>
                  <Form.Control type="text" placeholder="Your name" />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Email</Form.Label>
                  <Form.Control type="email" placeholder="your@email.com" />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Subject</Form.Label>
                  <Form.Control type="text" placeholder="Subject" />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Message</Form.Label>
                  <Form.Control as="textarea" rows={4} placeholder="Your message" />
                </Form.Group>
                <Button variant="primary" type="submit">
                  Submit
                </Button>
              </Form>
            </Col>
          </Row>
        </div>
      </Container>
    </div>
  )
}

export default ContactPage
