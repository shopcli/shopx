#!/usr/bin/env node
import { render } from 'ink'
import React from 'react'
import App from './app.js'

process.stdout.write('\x1b[2J\x1b[0f')
render(<App />)
