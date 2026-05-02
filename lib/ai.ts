import { gateway } from "@ai-sdk/gateway"
import { openai } from "@ai-sdk/openai"

// Use OpenAI directly if API key is set, otherwise use AI Gateway
const useOpenAI = !!process.env.OPENAI_API_KEY

export const trainerModel = useOpenAI 
  ? openai("gpt-4o") 
  : gateway("anthropic/claude-sonnet-4")

export const mateModel = useOpenAI 
  ? openai("gpt-4o") 
  : gateway("anthropic/claude-sonnet-4")

export const forgeFinalModel = useOpenAI 
  ? openai("gpt-4o") 
  : gateway("anthropic/claude-sonnet-4")
