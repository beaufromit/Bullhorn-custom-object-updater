# Bullhorn Custom Object GDPR Scripts

This is a collection of API scripts for Bullhorn that focus on preparing and implementing GDPR procedures. Note nothing in this repository should be considered legal advice, all deployments should be part of a greater GDPR automation system approved by your companies legal and/or compliance team.

# GDPR Custom Object Date Adjustment Script

The first script script is for adjusting the `date1` and `date2` fields on GDPR custom objects in Bullhorn (BH).

The usual setup provided by Bullhorn has `date1` as 'Date Sent' and `date2` as 'Date Received'. However, Bullhorn Automation (BHA) only sees `date1`, meaning it sees the date a GDPR request was sent as the date the request was received. This leads to false positives when searching for candidates with consent.

This script swaps these two fields in preparation for using BHA for GDPR purposes.

start with `npm run swap-dates`

# Legitimate Interest custom object

This script scans through all candidate records and checks all custom objects for a consent object with the legal basis 'Legitimate Interest' if no legitimate interest items are found it will add a new consent object with the date copied from the date the record was added.

start with `npm run add-legitimate-insterest`

## Further Details

Configuration and usage details to come
