try {
  require('./dist/main.js');
} catch (error) {
  console.error('Startup error:', error);
  console.error('Stack:', error.stack);
}
