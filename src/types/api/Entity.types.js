/**
 * One entity aggregation row from the statements API
 * (`/api/v1/entities`) — an entity's transaction counts and cash flow over a
 * date range.
 * @typedef {Object} Entity
 * @property {string} [entity]   The counterparty/entity name (null-ish when unmatched).
 * @property {string} [type]     Transaction type this row aggregates.
 * @property {number} [count]    Number of transactions.
 * @property {number} [inflow]   Total inflow amount.
 * @property {number} [outflow]  Total outflow amount.
 */

export {};
