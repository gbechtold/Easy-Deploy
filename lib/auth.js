const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const chalk = require('chalk');

/**
 * Configure Google OAuth authentication
 */
function configureAuth(app, dbManager) {
  // Serialize user to session
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await dbManager.findUserById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  // Configure Google OAuth Strategy
  const callbackURL = process.env.GOOGLE_CALLBACK_URL ||
    `http://${process.env.SERVER_HOST || 'localhost'}:${process.env.SERVER_PORT || 3000}/auth/google/callback`;

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: callbackURL
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Check if user exists
          let user = await dbManager.findUserByGoogleId(profile.id);

          if (!user) {
            // Create new user
            const userId = await dbManager.createUser({
              google_id: profile.id,
              email: profile.emails[0].value,
              name: profile.displayName,
              avatar: profile.photos[0]?.value || null
            });

            user = await dbManager.findUserById(userId);
            console.log(chalk.green(`✓ New user created: ${user.email}`));
          } else {
            console.log(chalk.gray(`User logged in: ${user.email}`));
          }

          return done(null, user);
        } catch (error) {
          console.error(chalk.red('OAuth error:'), error);
          return done(error, null);
        }
      }
    )
  );

  // Initialize passport
  app.use(passport.initialize());
  app.use(passport.session());

  console.log(chalk.green('✓ Google OAuth configured'));
}

/**
 * Setup authentication routes
 */
function setupAuthRoutes(app) {
  // Google OAuth login
  app.get(
    '/auth/google',
    passport.authenticate('google', {
      scope: ['profile', 'email']
    })
  );

  // Google OAuth callback
  app.get(
    '/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
      // Successful authentication
      res.redirect('/dashboard');
    }
  );

  // Logout
  app.get('/auth/logout', (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error(chalk.red('Logout error:'), err);
      }
      res.redirect('/');
    });
  });

  // Check authentication status
  app.get('/auth/status', (req, res) => {
    if (req.isAuthenticated()) {
      res.json({
        authenticated: true,
        user: {
          id: req.user.id,
          email: req.user.email,
          name: req.user.name,
          avatar: req.user.avatar
        }
      });
    } else {
      res.json({ authenticated: false });
    }
  });

  console.log(chalk.green('✓ Auth routes configured'));
}

/**
 * Middleware to ensure user is authenticated
 */
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/auth/google');
}

/**
 * Middleware to check if user is authenticated (API)
 */
function requireAuth(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
}

/**
 * Validate OAuth configuration
 */
function validateOAuthConfig() {
  const required = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error(
      chalk.red('Error: Missing OAuth configuration:'),
      missing.join(', ')
    );
    console.log(
      chalk.yellow('\nPlease set the following environment variables in your .env file:')
    );
    missing.forEach(key => {
      console.log(chalk.cyan(`  ${key}=your_${key.toLowerCase()}_here`));
    });
    console.log(
      chalk.gray('\nTo get Google OAuth credentials:'),
      chalk.blue('https://console.cloud.google.com/apis/credentials')
    );
    return false;
  }

  console.log(chalk.green('✓ OAuth configuration validated'));
  return true;
}

module.exports = {
  configureAuth,
  setupAuthRoutes,
  ensureAuthenticated,
  requireAuth,
  validateOAuthConfig
};
