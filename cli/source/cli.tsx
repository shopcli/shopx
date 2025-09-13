#!/usr/bin/env node
import { withFullScreen } from 'fullscreen-ink'
import meow from 'meow'
import React from 'react'
import App from './app.js'

meow(
  `
Usage
    $ shopx

claude code for shopping

Examples
    $ shopx
    Start chatting with the AI assistant
`,
  {
    importMeta: import.meta,
  }
)

process.stdout.write('\x1b[2J\x1b[0f')
withFullScreen(<App />).start()
