import { useState } from 'react'
import { Link } from 'react-router-dom'
import './Header.css'
import { Container, Nav, Navbar, NavDropdown } from 'react-bootstrap'
import { resolveApiAssetUrl } from '../services/apiClient'

const psLogo = 'https://braumasta.github.io/passport-system-assets/passportsecuritylogo.png'

const Header = ({ currentUser, onLogout }) => {
  const [expanded, setExpanded] = useState(false)
  const canAccessOperations = ['admin', 'officer'].includes(currentUser?.role)
  const canAccessManagement = currentUser?.role === 'admin'
  const canAccessPassportApplication =
    currentUser?.role === 'applicant' && currentUser?.verification_status === 'verified'
  const displayName =
    currentUser?.full_name ||
    [currentUser?.first_name, currentUser?.middle_name, currentUser?.last_name].filter(Boolean).join(' ') ||
    currentUser?.email ||
    'Guest'
  const profilePhotoUrl = currentUser?.profile_photo_path
    ? resolveApiAssetUrl(currentUser.profile_photo_path)
    : ''

  const navItems = [
    { path: '/', label: 'Homepage' },
    canAccessPassportApplication ? { path: '/passport-application', label: 'Passport Applications' } : null,
    canAccessOperations ? { path: '/operations', label: 'Operations' } : null,
    canAccessManagement ? { path: '/management', label: 'Management' } : null,
    { path: '/contact', label: 'Contact Us' },
  ].filter(Boolean)

  const mainNavItems = [
    {
      label: 'About Passport Security',
      items: [
        { label: 'Functions of Passport Security', to: '/information/functions' },
        { label: 'Code of Conduct', to: '/information/code-of-conduct' },
        { label: 'Office hours', to: '/information/office-hours' },
        { label: 'Contact Us', to: '/contact' },
      ],
    },
    {
      label: 'Entry Visas',
      items: [
        { label: 'Types Of Visas', to: '/information/visa-types' },
        { label: 'Visa granted by the embassy', to: '/information/embassy-visa' },
        { label: 'Visa terms and conditions', to: '/information/visa-terms' },
      ],
    },
    {
      label: 'Passport Services',
      items: [
        { label: 'Lost Passport / Stolen Passport', to: '/information/lost-stolen-passport' },
        { label: 'Biometric passport', to: '/information/biometric-passport' },
        { label: 'Passport picture requirements', to: '/information/passport-picture-requirements' },
        { label: 'Retrieving archived passports', to: '/information/retrieving-archived-passports' },
        { label: 'Personal attendance required', to: '/information/personal-attendance' },
      ],
    },
  ]

  return (
    <>
      {/* Main header */}
      <Navbar
        expand="lg"
        className="ps-navbar shadow-sm"
        expanded={expanded}
        onToggle={setExpanded}
      >
        <Container>
          <Navbar.Brand as={Link} to="/" className="d-flex align-items-center">
            <img src={psLogo} alt="Passport Security" className="ps-logo me-2" />
            <span className="ps-brand-text fs-5 fw-semibold">Passport Security</span>
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="main-navbar" />
          <Navbar.Collapse id="main-navbar">
            <Nav className="ms-auto">
              {navItems.map((item) => (
                <Nav.Link key={item.path} as={Link} to={item.path} onClick={() => setExpanded(false)}>
                  {item.label}
                </Nav.Link>
              ))}
              <div className="d-lg-none">
                {currentUser ? (
                  <>
                    <Nav.Link as={Link} to="/account" onClick={() => setExpanded(false)}>
                      My Account
                    </Nav.Link>
                    {canAccessPassportApplication && (
                      <Nav.Link as={Link} to="/passport-application" onClick={() => setExpanded(false)}>
                        Passport Application
                      </Nav.Link>
                    )}
                    {canAccessOperations && (
                      <Nav.Link as={Link} to="/operations" onClick={() => setExpanded(false)}>
                        Operations
                      </Nav.Link>
                    )}
                    {canAccessManagement && (
                      <Nav.Link as={Link} to="/management" onClick={() => setExpanded(false)}>
                        Management
                      </Nav.Link>
                    )}
                    <div className="ps-mobile-account-summary px-3 py-2">
                      <div className="d-flex align-items-center gap-3">
                        <span className="ps-mobile-account-avatar">
                          {profilePhotoUrl ? (
                            <img src={profilePhotoUrl} alt={displayName} className="ps-profile-photo" />
                          ) : (
                            <span className="ps-profile-fallback">{displayName.charAt(0).toUpperCase()}</span>
                          )}
                        </span>
                        <div>
                          <div className="fw-semibold">{displayName}</div>
                          <div className="small text-muted">{currentUser.email}</div>
                          <div className="small text-capitalize">
                            {currentUser.role} · {currentUser.verification_status || 'pending'}
                          </div>
                        </div>
                      </div>
                    </div>
                    <Nav.Link
                      as="button"
                      type="button"
                      className="ps-mobile-account-action"
                      onClick={() => {
                        onLogout()
                        setExpanded(false)
                      }}
                    >
                      Logout
                    </Nav.Link>
                  </>
                ) : (
                  <>
                    <Nav.Link as={Link} to="/login" onClick={() => setExpanded(false)}>
                      Login
                    </Nav.Link>
                    <Nav.Link as={Link} to="/register" onClick={() => setExpanded(false)}>
                      Create Account
                    </Nav.Link>
                  </>
                )}
              </div>
            </Nav>
            <div className="d-none d-lg-flex align-items-center ms-lg-3">
              {currentUser ? (
                <NavDropdown
                  align="end"
                  title={
                    <span className="ps-profile-trigger">
                      {profilePhotoUrl ? (
                        <img src={profilePhotoUrl} alt={displayName} className="ps-profile-photo" />
                      ) : (
                        <span className="ps-profile-fallback">
                          {displayName.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </span>
                  }
                  id="account-dropdown"
                  className="ps-account-dropdown"
                >
                  <>
                    <NavDropdown.Header>
                      <div className="fw-semibold">{displayName}</div>
                      <div className="small text-muted">{currentUser.email}</div>
                      <div className="small text-capitalize">
                        {currentUser.role} · {currentUser.verification_status || 'pending'}
                      </div>
                    </NavDropdown.Header>
                    <NavDropdown.Item as={Link} to="/account">
                      My Account
                    </NavDropdown.Item>
                    {canAccessPassportApplication && (
                      <NavDropdown.Item as={Link} to="/passport-application">
                        Passport Application
                      </NavDropdown.Item>
                    )}
                    {canAccessOperations && (
                      <NavDropdown.Item as={Link} to="/operations">
                        Operations
                      </NavDropdown.Item>
                    )}
                    {canAccessManagement && (
                      <NavDropdown.Item as={Link} to="/management">
                        Management
                      </NavDropdown.Item>
                    )}
                    <NavDropdown.Divider />
                    <NavDropdown.Item onClick={onLogout}>
                      Logout
                    </NavDropdown.Item>
                  </>
                </NavDropdown>
              ) : (
                <Link to="/login" className="ps-sign-in-button">
                  Sign in
                </Link>
              )}
            </div>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      {/* Main navigation - Mega menu style */}
      <nav className="ps-main-nav bg-primary py-2">
        <Container>
          <Nav className="flex-wrap">
            {mainNavItems.map((navItem) => (
              <NavDropdown
                key={navItem.label}
                title={navItem.label}
                id={`nav-${navItem.label.replace(/\s/g, '-')}`}
                className="ps-nav-dropdown"
              >
                {navItem.items.map((item) => (
                  <NavDropdown.Item
                    key={item.to}
                    as={Link}
                    to={item.to}
                    onClick={() => setExpanded(false)}
                  >
                    {item.label}
                  </NavDropdown.Item>
                ))}
              </NavDropdown>
            ))}
          </Nav>
        </Container>
      </nav>
    </>
  )
}

export default Header
