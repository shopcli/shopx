import { Box, Text } from 'ink'
import Spinner from 'ink-spinner'
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

  return (
    <Box flexDirection="row" alignItems="center">
      <Text color={color}>
        <Spinner type="dots9" />
      </Text>
      <Text color={color}> {currentText}</Text>
    </Box>
  )
}
