import { Box, Text } from 'ink'
import React, { useEffect, useState } from 'react'
import terminalImage from 'terminal-image'

export default function Image(props: {
  src: string | Uint8Array | Buffer
  alt: any
  width?: string | number
  height?: string | number
  preserveAspectRatio?: boolean
}) {
  const [imageString, setImageString] = useState<string>('')
  // @ts-ignore
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadImage = async () => {
      try {
        console.log(
          'Loading image, src type:',
          typeof props.src,
          'is Buffer:',
          props.src instanceof Buffer
        )

        const { width, height, preserveAspectRatio } = props
        const options: {
          width?: string | number
          height?: string | number
          preserveAspectRatio?: boolean
        } = {}

        if (width !== undefined) options.width = width
        if (height !== undefined) options.height = height
        if (preserveAspectRatio !== undefined)
          options.preserveAspectRatio = preserveAspectRatio

        let result: string

        // Add timeout to prevent hanging
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Image loading timeout')), 3000)
        })

        // Handle Buffer/Uint8Array for image data
        if (props.src instanceof Buffer || props.src instanceof Uint8Array) {
          console.log('Processing buffer, length:', props.src.length)
          // Convert Buffer to Uint8Array if needed
          const buffer =
            props.src instanceof Buffer ? new Uint8Array(props.src) : props.src
          result = await Promise.race([
            terminalImage.buffer(buffer, options),
            timeoutPromise,
          ])
          console.log('Image loaded successfully, length:', result.length)
        } else {
          // Handle file path
          result = await Promise.race([
            terminalImage.file(props.src, options),
            timeoutPromise,
          ])
        }

        // Check if result is empty or just whitespace
        if (!result || result.trim().length === 0) {
          console.log(
            'Image processing returned empty result, showing fallback'
          )
          setImageString('🖼️ [Image loaded but terminal cannot display images]')
        } else {
          setImageString(result)
        }
      } catch (err) {
        console.error('Image loading error:', err)
        // Show a simple text representation as fallback
        setImageString('🖼️ [Image loaded but cannot display in terminal]')
      }
    }

    loadImage()
  }, [
    props.src,
    props.alt,
    props.width,
    props.height,
    props.preserveAspectRatio,
  ])

  if (error) {
    return (
      <Box>
        <Text color="red">[Image Error: {error}]</Text>
      </Box>
    )
  }

  if (!imageString) {
    return (
      <Box>
        <Text>Loading image...</Text>
      </Box>
    )
  }

  // Split by newlines and render each line separately
  const lines = imageString.split('\n')

  return (
    <Box flexDirection="column">
      {lines.map((line: string, index: number) => (
        <Text key={index}>{line}</Text>
      ))}
    </Box>
  )
}
