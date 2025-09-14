import { Box, Text } from 'ink'
import React, { useEffect, useState } from 'react'
import { loadingFlavourTexts } from '../config/flavour.js'

interface Props {
  color?: string
}

export default function FlavourText({ color = 'green' }: Props) {
  const [currentText, setCurrentText] = useState('')

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * loadingFlavourTexts.length)
    setCurrentText(loadingFlavourTexts[randomIndex] || '')

    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * loadingFlavourTexts.length)
      setCurrentText(loadingFlavourTexts[randomIndex] || '')
    }, 10000)

    return () => clearInterval(interval)
  }, [])

  const paddedText = currentText.padEnd(50, ' ')

  return (
    <Box flexDirection="row" alignItems="center" width={80}>
      {/* <Spinner type="dots9" /> */}
      <Text color={color}> {paddedText}</Text>
    </Box>
  )
}
