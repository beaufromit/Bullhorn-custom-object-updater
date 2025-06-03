# GDPR Custom Object Date Adjustment Script

This script is for adjusting the `date1` and `date2` fields on GDPR custom objects in Bullhorn (BH).

## Overview

The usual setup provided by Bullhorn has `date1` as 'Date Sent' and `date2` as 'Date Received'. However, Bullhorn Automation (BHA) only sees `date1`, meaning it sees the date a GDPR request was sent as the date the request was received. This leads to false positives when searching for candidates with consent.

This script swaps these two fields in preparation for using BHA for GDPR purposes.

## Further Details

Further details to come.
