import { Box, Text } from 'ink'
import React from 'react'
import termImg from 'term-img'

export default function Image(props: { src: any; alt: any }) {
  try {
    const imageString = termImg.string(
      props.src,
      Object.assign(
        Object.fromEntries(
          Object.entries(props).filter(
            ([key]) => key !== 'src' && key !== 'alt'
          )
        ),
        {
          fallback: () => props.alt || 'Screenshot',
        }
      )
    )

    // Split by newlines and render each line separately
    const lines = imageString.split('\n')

    return (
      <Box flexDirection="column">
        {lines.map((line: string, index: number) => (
          <Text key={index}>{line}</Text>
        ))}
      </Box>
    )
  } catch (error) {
    return (
      <Box>
        <Text color="red">[Image Error: {props.alt || 'Screenshot'}]</Text>
      </Box>
    )
  }
}
