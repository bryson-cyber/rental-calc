/**
 * HubSpot Integration Module
 * Handles contact creation, updates, and email automation for the rental calculator
 */

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

interface HubSpotContact {
  id: string;
  properties: {
    email: string;
    firstname?: string;
    lastname?: string;
    phone?: string;
    [key: string]: string | undefined;
  };
}

interface CreateContactInput {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  source?: string;
  toolUsed?: string;
  marketAnalyzed?: string;
  estimatedRevenue?: number;
  propertyAddress?: string;
  deepLink?: string;
}

interface HubSpotError {
  status: string;
  message: string;
  correlationId: string;
  category: string;
}

/**
 * Make authenticated request to HubSpot API
 */
async function hubspotRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  if (!HUBSPOT_API_KEY) {
    throw new Error('HUBSPOT_API_KEY is not configured');
  }

  const response = await fetch(`${HUBSPOT_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as HubSpotError;
    throw new Error(`HubSpot API error: ${response.status} - ${errorData.message || response.statusText}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Search for an existing contact by email
 */
export async function findContactByEmail(email: string): Promise<HubSpotContact | null> {
  try {
    const response = await hubspotRequest<{ results: HubSpotContact[] }>(
      '/crm/v3/objects/contacts/search',
      {
        method: 'POST',
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                {
                  propertyName: 'email',
                  operator: 'EQ',
                  value: email,
                },
              ],
            },
          ],
          properties: [
            'email',
            'firstname',
            'lastname',
            'phone',
            'rental_calculator_lead_source',
            'rental_calculator_last_tool_used',
            'rental_calculator_city',
            'rental_calculator_state',
            'rental_calculator_estimated_revenue',
            'rental_calculator_property_address',
            'deep_link_url',
          ],
        }),
      }
    );

    return response.results.length > 0 ? response.results[0] : null;
  } catch (error) {
    console.error('Error searching for contact:', error);
    return null;
  }
}

/**
 * Create a new contact in HubSpot
 */
export async function createContact(input: CreateContactInput): Promise<HubSpotContact> {
  const properties: Record<string, string> = {
    email: input.email,
  };

  if (input.firstName) properties.firstname = input.firstName;
  if (input.lastName) properties.lastname = input.lastName;
  if (input.phone) properties.phone = input.phone;
  if (input.source) properties.rental_calculator_lead_source = input.source;
  if (input.toolUsed) properties.rental_calculator_last_tool_used = input.toolUsed;
  if (input.marketAnalyzed) {
    // Parse city and state from market string like "Austin, TX"
    const parts = input.marketAnalyzed.split(',').map(s => s.trim());
    if (parts[0]) properties.rental_calculator_city = parts[0];
    if (parts[1]) properties.rental_calculator_state = parts[1];
  }
  if (input.estimatedRevenue) properties.rental_calculator_estimated_revenue = String(input.estimatedRevenue);
  if (input.propertyAddress) properties.rental_calculator_property_address = input.propertyAddress;
  if (input.deepLink) properties.deep_link_url = input.deepLink;

  return hubspotRequest<HubSpotContact>('/crm/v3/objects/contacts', {
    method: 'POST',
    body: JSON.stringify({ properties }),
  });
}

/**
 * Update an existing contact in HubSpot
 */
export async function updateContact(
  contactId: string,
  input: Partial<CreateContactInput>
): Promise<HubSpotContact> {
  const properties: Record<string, string> = {};

  if (input.firstName) properties.firstname = input.firstName;
  if (input.lastName) properties.lastname = input.lastName;
  if (input.phone) properties.phone = input.phone;
  if (input.source) properties.rental_calculator_lead_source = input.source;
  if (input.toolUsed) properties.rental_calculator_last_tool_used = input.toolUsed;
  if (input.marketAnalyzed) {
    // Parse city and state from market string like "Austin, TX"
    const parts = input.marketAnalyzed.split(',').map(s => s.trim());
    if (parts[0]) properties.rental_calculator_city = parts[0];
    if (parts[1]) properties.rental_calculator_state = parts[1];
  }
  if (input.estimatedRevenue) properties.rental_calculator_estimated_revenue = String(input.estimatedRevenue);
  if (input.propertyAddress) properties.rental_calculator_property_address = input.propertyAddress;
  if (input.deepLink) properties.deep_link_url = input.deepLink;

  return hubspotRequest<HubSpotContact>(`/crm/v3/objects/contacts/${contactId}`, {
    method: 'PATCH',
    body: JSON.stringify({ properties }),
  });
}

/**
 * Create or update a contact (upsert)
 * If contact exists, update it; otherwise create new
 */
export async function upsertContact(input: CreateContactInput): Promise<{
  contact: HubSpotContact;
  isNew: boolean;
}> {
  // First, try to find existing contact
  const existingContact = await findContactByEmail(input.email);

  if (existingContact) {
    // Update existing contact
    const updatedContact = await updateContact(existingContact.id, input);
    return { contact: updatedContact, isNew: false };
  } else {
    // Create new contact
    const newContact = await createContact(input);
    return { contact: newContact, isNew: true };
  }
}

/**
 * Add a contact to a static list
 */
export async function addContactToList(contactId: string, listId: string): Promise<void> {
  await hubspotRequest(`/contacts/v1/lists/${listId}/add`, {
    method: 'POST',
    body: JSON.stringify({
      vids: [parseInt(contactId, 10)],
    }),
  });
}

/**
 * Get all static lists
 */
export async function getLists(): Promise<Array<{ listId: number; name: string }>> {
  const response = await hubspotRequest<{ lists: Array<{ listId: number; name: string }> }>(
    '/contacts/v1/lists/static'
  );
  return response.lists;
}

/**
 * Create a static list
 */
export async function createList(name: string): Promise<{ listId: number; name: string }> {
  return hubspotRequest<{ listId: number; name: string }>('/contacts/v1/lists', {
    method: 'POST',
    body: JSON.stringify({
      name,
      dynamic: false,
    }),
  });
}

/**
 * Generate a personalized deep link for email campaigns
 */
export function generateDeepLink(params: {
  baseUrl: string;
  tool: string;
  market?: string;
  city?: string;
  state?: string;
  email?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}): string {
  const url = new URL(params.baseUrl);
  
  // Set the tool path
  const toolPaths: Record<string, string> = {
    'calculator': '/',
    'market-advisor': '/market-advisor',
    'opportunity-finder': '/opportunity-finder',
    'market-discovery': '/discover-markets',
    'market-comparison': '/compare-markets',
    'map': '/map',
  };
  
  url.pathname = toolPaths[params.tool] || '/';
  
  // Add market/location parameters
  if (params.market) url.searchParams.set('market', params.market);
  if (params.city) url.searchParams.set('city', params.city);
  if (params.state) url.searchParams.set('state', params.state);
  
  // Add UTM tracking parameters
  if (params.utm_source) url.searchParams.set('utm_source', params.utm_source);
  if (params.utm_medium) url.searchParams.set('utm_medium', params.utm_medium);
  if (params.utm_campaign) url.searchParams.set('utm_campaign', params.utm_campaign);
  
  // Add email for personalization tracking
  if (params.email) url.searchParams.set('ref', Buffer.from(params.email).toString('base64'));
  
  return url.toString();
}

/**
 * Track a lead conversion event
 * Call this when a user completes a significant action
 */
export async function trackLeadEvent(params: {
  email: string;
  eventType: 'calculator_completed' | 'market_analyzed' | 'property_saved' | 'report_generated';
  eventData?: Record<string, string | number>;
}): Promise<void> {
  // Find the contact
  const contact = await findContactByEmail(params.email);
  if (!contact) {
    console.warn(`Contact not found for event tracking: ${params.email}`);
    return;
  }

  // Update contact with event timestamp
  const eventProperty = `rental_calculator_${params.eventType}_at`;
  await updateContact(contact.id, {
    [eventProperty]: new Date().toISOString(),
    ...params.eventData,
  } as any);
}

/**
 * Batch create or update contacts
 */
export async function batchUpsertContacts(
  contacts: CreateContactInput[]
): Promise<{ created: number; updated: number; errors: number }> {
  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const contact of contacts) {
    try {
      const result = await upsertContact(contact);
      if (result.isNew) {
        created++;
      } else {
        updated++;
      }
    } catch (error) {
      console.error(`Error upserting contact ${contact.email}:`, error);
      errors++;
    }
  }

  return { created, updated, errors };
}

/**
 * Get contact properties (for checking if custom properties exist)
 */
export async function getContactProperties(): Promise<Array<{ name: string; label: string }>> {
  const response = await hubspotRequest<Array<{ name: string; label: string }>>(
    '/crm/v3/properties/contacts'
  );
  return response;
}

/**
 * Create a custom contact property
 */
export async function createContactProperty(params: {
  name: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'datetime';
  groupName?: string;
}): Promise<void> {
  await hubspotRequest('/crm/v3/properties/contacts', {
    method: 'POST',
    body: JSON.stringify({
      name: params.name,
      label: params.label,
      type: params.type,
      fieldType: params.type === 'string' ? 'text' : params.type,
      groupName: params.groupName || 'contactinformation',
    }),
  });
}

export default {
  findContactByEmail,
  createContact,
  updateContact,
  upsertContact,
  addContactToList,
  getLists,
  createList,
  generateDeepLink,
  trackLeadEvent,
  batchUpsertContacts,
  getContactProperties,
  createContactProperty,
};
