import { useParams, Link } from 'react-router-dom'
import { Container, Row, Col, Table } from 'react-bootstrap'

// Sample content matching the Biometric passport page structure (posts/11)
const postContent = {
  '11': {
    title: 'Biometric passport',
    relatedLinks: [
      { label: 'Passport of an adopted, born in special circumstances child or a citizen without a family name', path: '/posts/71' },
      { label: 'Lost Passport / Stolen Passport', path: '/posts/14' },
      { label: 'Diverse services', path: '/posts/358' },
      { label: 'Exporting a biometric passport', path: '/posts/72' },
      { label: 'Certifying copies of passport pages', path: '/posts/86' },
      { label: 'Modification of some letters', path: '/posts/76' },
      { label: 'Passport picture requirements', path: '/posts/80' },
      { label: 'Retrieving archived passports', path: '/posts/187' },
      { label: 'Personal attendance required', path: '/posts/73' },
    ],
    requestedDocuments: [
      'The adequate application for passports format A4 (10 years) issued by the competent mayor according to the place of residence.',
      'National ID card and/or an extract of civil status for first-time biometric passport applications.',
      'A new colored photo ID photo on a white background, 4.5 x 3.5, on which the name of the individual appears, as well as the number and place of registered residence, signed and certified by the mayor.',
      'The old passport if the latter is available, as well as a copy of the pages that are not empty.',
      'The fees related to this application.',
    ],
    remarks: [
      'The id photo has to conform to current regulations.',
      'The regular substitution of the biometric passport can be requested by the interested party.',
      'When it comes to minors aged 18 years or less, the authorization of both parents is requested.',
      'The copies attached to the application have to be in an A4 format.',
    ],
    fees: [
      { document: 'Passport valid for 5 years', fees: '6,000,000 L.L' },
      { document: 'Passport valid for 10 years', fees: '10,000,000 L.L' },
      { document: 'Passport – first class - 5 years', fees: '30,000,000 L.L' },
      { document: 'Passport – second class - 5 years', fees: '20,000,000 L.L' },
      { document: 'Passport – first class - 10 years', fees: '60,000,000 L.L' },
      { document: 'Passport – second class - 10 years', fees: '40,000,000 L.L' },
    ],
    note: 'To receive the passport immediately, the interested party can apply at the department of public relations. An additional fee of LBP 4,900,000 will be however requested.',
  },
}

const PostPage = () => {
  const { id } = useParams()
  const post = postContent[id] || postContent['11']

  return (
    <div className="ps-post-page ps-page-shell py-5">
      <Container>
        <div className="bg-white rounded shadow-sm p-4 p-lg-5 mb-4">
          <h1 className="mb-4" style={{ color: 'var(--ps-primary)' }}>
            {post.title}
          </h1>

          <Row>
            <Col lg={8}>
              <div className="mb-4 p-3 rounded bg-primary bg-opacity-10 border border-primary border-opacity-25">
                <h2 className="h5 mb-2">Apply Online</h2>
                <p className="text-muted small mb-2">
                  Schedule your passport renewal or new passport application. Submit your documents and receive a confirmation ticket by email.
                </p>
                <Link to="/passport-application" className="btn btn-primary">
                  Start passport application
                </Link>
              </div>

              <div className="mb-4">
                <h2 className="h5 mb-3">Requested documents:</h2>
                <ul>
                  {post.requestedDocuments.map((doc, i) => (
                    <li key={i} className="mb-2">{doc}</li>
                  ))}
                </ul>
              </div>

              <div className="mb-4">
                <h2 className="h5 mb-3">Remarks:</h2>
                <ul>
                  {post.remarks.map((remark, i) => (
                    <li key={i} className="mb-2">{remark}</li>
                  ))}
                </ul>
              </div>

              <div className="mb-4">
                <h2 className="h5 mb-3">Fees:</h2>
                <Table bordered responsive>
                  <thead className="table-light">
                    <tr>
                      <th>Document requested</th>
                      <th>Fees</th>
                    </tr>
                  </thead>
                  <tbody>
                    {post.fees.map((row, i) => (
                      <tr key={i}>
                        <td>{row.document}</td>
                        <td>{row.fees}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                {post.note && (
                  <p className="text-muted small mt-2">
                    <strong>NB:</strong> {post.note}
                  </p>
                )}
              </div>
            </Col>

            <Col lg={4}>
              <div className="ps-related-links bg-light rounded p-3 position-sticky" style={{ top: 100 }}>
                <h3 className="h6 text-primary mb-3">Related Links</h3>
                <ul className="list-unstyled">
                  {post.relatedLinks.map((link) => (
                    <li key={link.path} className="mb-2">
                      <Link to={link.path} className="text-decoration-none small">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </Col>
          </Row>
        </div>
      </Container>
    </div>
  )
}

export default PostPage
