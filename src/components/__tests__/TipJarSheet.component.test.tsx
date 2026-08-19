/**
 * Component test — TipJarSheet (Uplevel-3 T3 action coverage).
 *
 * Three actions across the sheet's states:
 *   • A tier button (status "ready") → onTip fires with the product id.
 *   • "Maybe later" (any non-thanks state) → dismisses.
 *   • "Done" (status "thanks") → dismisses.
 *
 * The tier button is named by its price alone, because the visible text is the
 * price alone — putting "Tip" in front of it made the control unspeakable to a
 * Voice Control user, so querying by the bare price is what keeps that from
 * drifting back. Prices come from the mocked product's `displayPrice`, matching
 * the never-hardcode-a-price contract.
 *
 * We control the IAP state by mocking `../lib/tipJar` (the native billing hook),
 * never the component under test.
 */

import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';

jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  isLoaded: () => true,
  loadAsync: () => Promise.resolve(),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Controllable IAP hook — set by each test before render.
const mockTip = jest.fn();
let mockTipState: {
  status: string;
  products: { id: string; displayPrice: string }[];
  pendingSku: string | null;
};
jest.mock('../../lib/tipJar', () => ({
  isStoreKnownUnavailable: () => false,
  useTipJar: () => ({ ...mockTipState, tip: mockTip }),
}));

import TipJarSheet from '../TipJarSheet';
import { TIP_PRODUCT_IDS } from '../../constants/tipProducts';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('TipJarSheet', () => {
  it('fires onTip with the product id when a tier is pressed', async () => {
    mockTipState = {
      status: 'ready',
      products: [
        { id: TIP_PRODUCT_IDS[0], displayPrice: '$2.99' },
        { id: TIP_PRODUCT_IDS[1], displayPrice: '$4.99' },
      ],
      pendingSku: null,
    };
    const user = userEvent.setup({ delay: 0 });

    await render(<TipJarSheet visible onDismiss={jest.fn()} productIds={TIP_PRODUCT_IDS} />);

    await user.press(screen.getByRole('button', { name: '$4.99' }));

    expect(mockTip).toHaveBeenCalledWith(TIP_PRODUCT_IDS[1]);
  });

  it('dismisses when Maybe later is pressed', async () => {
    mockTipState = { status: 'ready', products: [], pendingSku: null };
    const onDismiss = jest.fn();
    const user = userEvent.setup({ delay: 0 });

    await render(<TipJarSheet visible onDismiss={onDismiss} productIds={TIP_PRODUCT_IDS} />);

    await user.press(screen.getByRole('button', { name: 'Maybe later' }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('dismisses when Done is pressed in the thank-you state', async () => {
    mockTipState = { status: 'thanks', products: [], pendingSku: null };
    const onDismiss = jest.fn();
    const user = userEvent.setup({ delay: 0 });

    await render(<TipJarSheet visible onDismiss={onDismiss} productIds={TIP_PRODUCT_IDS} />);

    await user.press(screen.getByRole('button', { name: 'Done' }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('offers no way out but Done once the tip landed', async () => {
    mockTipState = { status: 'thanks', products: [], pendingSku: null };

    await render(<TipJarSheet visible onDismiss={jest.fn()} productIds={TIP_PRODUCT_IDS} />);

    // "Maybe later" after someone has already paid would read as another ask.
    expect(screen.queryByRole('button', { name: 'Maybe later' })).toBeNull();
  });
});
