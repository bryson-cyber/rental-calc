# HubSpot Property Internal Names

Found from HubSpot Settings → Properties on Jan 30, 2026

## Data Perfection Fields (from LeadFi)

| Display Name | Internal Name |
|-------------|---------------|
| Data Perfection: City | `data_perfection__city` |
| Data Perfection: State | `data_perfection__state` |
| Data Perfection: Postal Code | `data_perfection__postal_code` |
| Data Perfection: Address | `data_perfection__address` |
| Data Perfection: Phones | `data_perfection__phones` |
| Data Perfection: Age | `data_perfection__age` |

## Personalized Link Format for HubSpot Emails

Use these tokens in your HubSpot email templates:

```
https://coachinayahturnkeytool.com/?tab=prove&city={{contact.data_perfection__city}}&state={{contact.data_perfection__state}}&zip={{contact.data_perfection__postal_code}}
```

## Example Links by Tool

**See Real Revenue (prove tab):**
```
https://coachinayahturnkeytool.com/?tab=prove&city={{contact.data_perfection__city}}&state={{contact.data_perfection__state}}
```

**Check Regulations (regulations tab):**
```
https://coachinayahturnkeytool.com/?tab=regulations&city={{contact.data_perfection__city}}&state={{contact.data_perfection__state}}
```

**Explore Markets (explore tab):**
```
https://coachinayahturnkeytool.com/?tab=explore&city={{contact.data_perfection__city}}&state={{contact.data_perfection__state}}
```

**Market Advisor (advisor tab):**
```
https://coachinayahturnkeytool.com/?tab=advisor&city={{contact.data_perfection__city}}&state={{contact.data_perfection__state}}
```
