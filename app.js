const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const favicon = require('serve-favicon');
const morgan = require('morgan');
const session = require('express-session');
const mongoose = require('mongoose');
const passport = require('passport');

require('dotenv').config()
const app = express();
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.use(morgan('dev'));
app.use(cookieParser());

app.use(session({
  secret: process.env.SESS_SECRET,
  resave: true,
  saveUninitialized: true,
  cookie: { secure: false }
}))

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

mongoose.connect(process.env.DB_CONN_DEV, { useNewUrlParser : true }).then(
  () => { console.log("Connected to database!") },
  err => { console.log("ERROR - Database connection failed")}
)


require('./passport.js')(passport);
app.use(passport.initialize() );
app.use(passport.session() )

app.use('/', require('./routing/masterRouter') );

app.use( (req, res, next) => {
  let err = new Error('Not found');
  err.status = 404;
  next(err);
})

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;