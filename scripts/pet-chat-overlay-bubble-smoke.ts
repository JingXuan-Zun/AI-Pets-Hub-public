import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PetChatOverlayBubble } from '../src/components/chat/PetChatOverlayBubble';

const baseProps = {
  chatBracketOuterTextColor: '#0f766e',
  chatBubbleEnabled: true,
  isPrimaryTyping: false,
  latestPetMessage: '气泡回归检查',
  petAnchorPosition: { x: 420, y: 360 },
  petVisualBounds: { top: 180 },
};

const enabledMarkup = renderToStaticMarkup(createElement(PetChatOverlayBubble, baseProps));
assert.match(enabledMarkup, /气泡回归检查/, 'the latest pet reply should render in the bubble');
assert.match(enabledMarkup, /rounded-2xl[^"]*bg-white\/90/, 'the reply should render inside a visible rounded bubble');
assert.match(enabledMarkup, /aria-hidden="true"[^>]*class="[^"]*-bottom-1/, 'the bubble should include a small pointer toward the pet');

const disabledMarkup = renderToStaticMarkup(createElement(PetChatOverlayBubble, { ...baseProps, chatBubbleEnabled: false }));
assert.equal(disabledMarkup, '', 'disabling chat bubbles should hide the entire bubble');

console.log('pet chat overlay bubble smoke ok');
