# Prompt Enhancer

A Chrome extension that rewrites your rough prompts into structured, high-quality ones before you send them to ChatGPT, Claude, Gemini, or any other AI.

I built this because I got tired of spending 5 minutes polishing every prompt before hitting send. Type something rough, click the button, get a better version back. It does a self-critique pass internally so you don't have to.

## Install

1. Download or clone this repo
2. Go to `chrome://extensions` in your browser
3. Enable Developer mode (toggle in the top right)
4. Click "Load unpacked" and select the `prompt-enhancer` folder
5. The extension icon appears in your toolbar

## Usage

Visit any supported AI site (ChatGPT, Claude, Gemini, etc.), click inside a text field, and press the floating button. A progress modal shows while it works, then you get the enhanced prompt in an overlay. Use it or keep your original.

## API key

It works without an API key using shared free models, but it's slower. Add your own OpenRouter, OpenAI, or Gemini key in extension settings for instant results. Your key stays in your browser — nothing is sent anywhere except the API provider you choose.

## Tech stack

- Vanilla JavaScript (no frameworks)
- Chrome Extension Manifest V3
- OpenRouter API

## Notes

This is a work in progress. The enhancement quality depends on the model being used. Free models can be rate-limited or slow. If it doesn't work the first time, try again in a few seconds.
