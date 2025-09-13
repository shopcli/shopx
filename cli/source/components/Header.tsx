import { Text } from 'ink'
import Gradient from 'ink-gradient'
import React from 'react'
import { semiMutedColor } from '../config/colors.js'

const ascii = `
 ███                  █████                                    
░░░███               ░░███                                     
  ░░░███       ██████ ░███████    █████   ████████  █████ █████
    ░░░███    ███░░   ░███░░███  ███░░███░░███░░███░░███ ░░███ 
     ███░    ░░█████  ░███ ░███ ░███ ░███ ░███ ░███ ░░░█████░  
   ███░       ░░░░███ ░███ ░███ ░███ ░███ ░███ ░███  ███░░░███ 
 ███░         ██████  ████ █████░░██████  ░███████  █████ █████
░░░          ░░░░░░   ░░░░ ░░░░░  ░░░░░░  ░███░░░  ░░░░░ ░░░░░ 
                                          ░███                 
                                          █████                
                                         ░░░░░                 
                                         `

export default function Header() {
  return (
    <>
      <Gradient name="summer">
        <Text>{ascii}</Text>
      </Gradient>
      <Text color={semiMutedColor}>
        Welcome to shopx! Here are some tips for getting started:
      </Text>
      <Text color={semiMutedColor}>
        1. Type below to buy products or get recommendations
      </Text>
      <Text color={semiMutedColor}>
        2. Interact and see info about product details and pricing
      </Text>
      <Text color={semiMutedColor}>
        3. <Text color="green">/help</Text> for more information.
      </Text>
    </>
  )
}
