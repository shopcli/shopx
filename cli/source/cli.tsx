#!/usr/bin/env node
import { render } from 'ink'
import meow from 'meow'
import React from 'react'
import App from './app.js'

meow(
  `
Usage
    $ shopx

A Claude-like terminal interface for conversations.

Examples
    $ shopx
    Start chatting with the AI assistant
`,
  {
    importMeta: import.meta,
  }
)

render(<App />)
