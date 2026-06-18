import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Container, Row, Col } from 'react-bootstrap'
import './Footer.css'

const footerEmblem = 'https://braumasta.github.io/passport-system-assets/passportsecuritylogo.png'

const InternalFooterLink = ({ to, label }) => (
  <Link to={to} className="text-white-50 text-decoration-none">
    {label}
  </Link>
)

const SocialIcon = ({ label, href, platform, children }) => (
  <a
    href={href}
    className={`ps-social-link ps-social-link--${platform}`}
    aria-label={label}
    target="_blank"
    rel="noreferrer"
  >
    {children}
  </a>
)

const Footer = () => {
  const [isExpanded, setIsExpanded] = useState(true)

  const aboutLinks = [
    { label: 'Functions of Passport Security', to: '/information/functions' },
    { label: 'Office hours', to: '/information/office-hours' },
    { label: 'Contact Us', to: '/contact' },
  ]

  const visaLinks = [
    { label: 'Types Of Visas', to: '/information/visa-types' },
    { label: 'Visa granted by the embassy', to: '/information/embassy-visa' },
    { label: 'Visa terms and conditions', to: '/information/visa-terms' },
  ]

  const passportLinks = [
    { label: 'Biometric passport', to: '/information/biometric-passport' },
    { label: 'Lost Passport / Stolen Passport', to: '/information/lost-stolen-passport' },
    { label: 'Passport picture requirements', to: '/information/passport-picture-requirements' },
    { label: 'Retrieving archived passports', to: '/information/retrieving-archived-passports' },
    { label: 'Personal attendance required', to: '/information/personal-attendance' },
  ]

  return (
    <footer className={`ps-footer mt-auto ${isExpanded ? 'is-expanded' : 'is-collapsed'}`}>
      <div className="ps-footer-topband">
        <Container className="ps-footer-topband-inner">
          <button
            type="button"
            className="ps-footer-toggle"
            aria-expanded={isExpanded}
            aria-controls="ps-footer-main"
            onClick={() => setIsExpanded((current) => !current)}
          >
            <span className="ps-footer-arrow" aria-hidden="true">
              <svg viewBox="0 0 44 24" focusable="false">
                <path d="M6 18L22 5L38 18" />
              </svg>
            </span>
            <span className="ps-footer-emblem">
              <img
                src={footerEmblem}
                alt=""
                aria-hidden="true"
                className="ps-footer-emblem-image ps-footer-emblem-image--open"
              />
              <img
                src={footerEmblem}
                alt=""
                aria-hidden="true"
                className="ps-footer-emblem-image ps-footer-emblem-image--open-hover"
              />
              <img
                src={footerEmblem}
                alt=""
                aria-hidden="true"
                className="ps-footer-emblem-image ps-footer-emblem-image--closed"
              />
              <img
                src={footerEmblem}
                alt=""
                aria-hidden="true"
                className="ps-footer-emblem-image ps-footer-emblem-image--hover"
              />
            </span>
          </button>
        </Container>
      </div>

      <div id="ps-footer-main" className={`ps-footer-main text-white ${isExpanded ? 'is-open' : 'is-closed'}`}>
        <Container className="ps-footer-main-inner">
          <div className="ps-footer-main-grid">
            <section className="ps-footer-column">
              <h6 className="fw-bold text-uppercase mb-3">About Passport Security</h6>
              <ul className="list-unstyled footer-links">
                {aboutLinks.map((link) => (
                  <li key={link.to}>
                    <InternalFooterLink to={link.to} label={link.label} />
                  </li>
                ))}
              </ul>
            </section>
            <section className="ps-footer-column">
              <h6 className="fw-bold text-uppercase mb-3">Entry Visas</h6>
              <ul className="list-unstyled footer-links">
                {visaLinks.map((link) => (
                  <li key={link.to}>
                    <InternalFooterLink to={link.to} label={link.label} />
                  </li>
                ))}
              </ul>
            </section>
            <section className="ps-footer-column">
              <h6 className="fw-bold text-uppercase mb-3">Passport Services</h6>
              <ul className="list-unstyled footer-links">
                {passportLinks.map((link) => (
                  <li key={link.to}>
                    <InternalFooterLink to={link.to} label={link.label} />
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </Container>
      </div>

      <div className="ps-footer-bottom text-white">
        <Container className="py-3">
          <Row className="align-items-center">
            <Col md={4} className="mb-3 mb-md-0">
              <div className="d-flex align-items-center gap-3">
                <span className="ps-footer-follow-label">Follow Us</span>
                <div className="d-flex gap-3">
                  <SocialIcon label="X" href="https://x.com" platform="x">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M18.901 2H21.98l-6.723 7.684L23.166 22h-6.19l-4.849-7.53L5.54 22H2.459l7.19-8.215L1.5 2h6.348l4.383 6.894L18.901 2Zm-1.085 18h1.706L6.92 3.896H5.09L17.816 20Z" />
                    </svg>
                  </SocialIcon>
                  <SocialIcon label="Facebook" href="https://facebook.com/passportsecurity" platform="facebook">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M13.5 21v-8.1h2.7l.4-3.15h-3.1V7.74c0-.91.25-1.53 1.56-1.53H16.7V3.39c-.29-.04-1.27-.12-2.41-.12-2.38 0-4.01 1.45-4.01 4.12v2.36H7.6v3.15h2.68V21h3.22Z" />
                    </svg>
                  </SocialIcon>
                  <SocialIcon label="Instagram" href="https://instagram.com" platform="instagram">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2Zm0 1.8A3.95 3.95 0 0 0 3.8 7.75v8.5a3.95 3.95 0 0 0 3.95 3.95h8.5a3.95 3.95 0 0 0 3.95-3.95v-8.5a3.95 3.95 0 0 0-3.95-3.95h-8.5Zm8.98 1.35a1.08 1.08 0 1 1 0 2.16 1.08 1.08 0 0 1 0-2.16ZM12 6.86A5.14 5.14 0 1 1 6.86 12 5.14 5.14 0 0 1 12 6.86Zm0 1.8A3.34 3.34 0 1 0 15.34 12 3.34 3.34 0 0 0 12 8.66Z" />
                    </svg>
                  </SocialIcon>
                </div>
              </div>
            </Col>
            <Col md={8} className="text-md-end">
              <div className="d-flex flex-wrap justify-content-center justify-content-md-end gap-2">
                <span className="text-white-50">© All Rights Reserved</span>
                <span className="ps-footer-divider">|</span>
                <InternalFooterLink to="/legal-notice" label="Legal Notice" />
                <span className="ps-footer-divider">|</span>
                <InternalFooterLink to="/contact" label="Contact Us" />
              </div>
            </Col>
          </Row>
        </Container>
      </div>
    </footer>
  )
}

export default Footer
