// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Polyfills for TextEncoder / TextDecoder used by some dependencies
const util = require('util');
// @ts-ignore
global.TextEncoder = global.TextEncoder || util.TextEncoder;
// @ts-ignore
global.TextDecoder = global.TextDecoder || util.TextDecoder;
