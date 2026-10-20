/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Payslip reading as the API layer sees it. The API reaches the business logic only through
 * bl/services (tests/architecture.test.ts), so the extraction field list is exposed here.
 */
export { PAYSLIP_FIELDS } from '../agent/extract.ts';
