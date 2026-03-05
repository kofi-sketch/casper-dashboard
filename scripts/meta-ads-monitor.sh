#!/bin/bash
# Meta Ads Performance Monitor
# Pulls metrics every 12h, logs to file, alerts on actionable insights

ADS_TOKEN="EAAXGAvxKqC8BQzGiLU1i4ASl0gM2AODeLydwkwGVxHUHdbZCIdOrsjVpbBfr6k0iaP4HhngrUZA9LJfqUqUxZAsjmH9ovkRI6ZB0mWRetWOr7Mg1FtFhMUobo5TIgoJJLrLy0OFxDXUlk2hfZA093k7mtW7jma5C2xD8UqOMMIeYlCt28TGUtwXZBgplYW4inW"
AD_ACCOUNT="act_1525507861883667"
# Active campaigns to track
PHASE2_CAMPAIGN="120245971387370768"  # Traqd Waitlist - Conversions (Phase 2) - ACTIVE
LOG_DIR="$HOME/.openclaw/workspace/traqd/ads-performance"
LOG_FILE="$LOG_DIR/metrics-$(date +%Y-%m-%d).json"
HISTORY_FILE="$LOG_DIR/history.jsonl"

mkdir -p "$LOG_DIR"

# Pull campaign-level insights
CAMPAIGN_DATA=$(curl -s "https://graph.facebook.com/v21.0/$AD_ACCOUNT/insights?fields=campaign_name,campaign_id,spend,impressions,reach,clicks,ctr,cpc,actions,cost_per_action_type&level=campaign&date_preset=last_7d&access_token=$ADS_TOKEN")

# Pull ad-set level insights
ADSET_DATA=$(curl -s "https://graph.facebook.com/v21.0/$AD_ACCOUNT/insights?fields=adset_name,adset_id,spend,impressions,reach,clicks,ctr,cpc,actions,cost_per_action_type&level=adset&date_preset=last_7d&access_token=$ADS_TOKEN")

# Pull ad-level insights
AD_DATA=$(curl -s "https://graph.facebook.com/v21.0/$AD_ACCOUNT/insights?fields=ad_name,ad_id,spend,impressions,reach,clicks,ctr,cpc,actions,cost_per_action_type&level=ad&date_preset=last_7d&access_token=$ADS_TOKEN")

# Pull today's data specifically
TODAY_DATA=$(curl -s "https://graph.facebook.com/v21.0/$AD_ACCOUNT/insights?fields=campaign_name,spend,impressions,reach,clicks,ctr,cpc,actions&level=campaign&date_preset=today&access_token=$ADS_TOKEN")

TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Save full snapshot
cat > "$LOG_FILE" << ENDJSON
{
  "timestamp": "$TIMESTAMP",
  "campaign_insights": $CAMPAIGN_DATA,
  "adset_insights": $ADSET_DATA,
  "ad_insights": $AD_DATA,
  "today": $TODAY_DATA
}
ENDJSON

# Append summary to history
SPEND=$(echo "$CAMPAIGN_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',[{}])[0].get('spend','0'))" 2>/dev/null || echo "0")
IMPRESSIONS=$(echo "$CAMPAIGN_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',[{}])[0].get('impressions','0'))" 2>/dev/null || echo "0")
REACH=$(echo "$CAMPAIGN_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',[{}])[0].get('reach','0'))" 2>/dev/null || echo "0")
CLICKS=$(echo "$CAMPAIGN_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',[{}])[0].get('clicks','0'))" 2>/dev/null || echo "0")
CTR=$(echo "$CAMPAIGN_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',[{}])[0].get('ctr','0'))" 2>/dev/null || echo "0")
CPC=$(echo "$CAMPAIGN_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',[{}])[0].get('cpc','0'))" 2>/dev/null || echo "0")

# Extract leads (Website leads action)
LEADS=$(echo "$CAMPAIGN_DATA" | python3 -c "
import sys,json
d=json.load(sys.stdin)
data=d.get('data',[{}])[0]
actions=data.get('actions',[])
leads=0
for a in actions:
    if a.get('action_type') in ('offsite_conversion.fb_pixel_lead','lead'):
        leads=int(float(a.get('value',0)))
print(leads)
" 2>/dev/null || echo "0")

echo "{\"ts\":\"$TIMESTAMP\",\"spend\":\"$SPEND\",\"impressions\":\"$IMPRESSIONS\",\"reach\":\"$REACH\",\"clicks\":\"$CLICKS\",\"ctr\":\"$CTR\",\"cpc\":\"$CPC\",\"leads\":\"$LEADS\"}" >> "$HISTORY_FILE"

# Output summary for cron agent
echo "=== META ADS PERFORMANCE REPORT ==="
echo "Timestamp: $TIMESTAMP"
echo "--- Last 7 Days (Campaign Level) ---"
echo "Spend: £$SPEND | Impressions: $IMPRESSIONS | Reach: $REACH"
echo "Clicks: $CLICKS | CTR: $CTR% | CPC: £$CPC"
echo "Leads: $LEADS"
echo ""
echo "--- Ad Set Breakdown ---"
echo "$ADSET_DATA" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for row in d.get('data',[]):
    name=row.get('adset_name','?')
    spend=row.get('spend','0')
    imp=row.get('impressions','0')
    clicks=row.get('clicks','0')
    ctr=row.get('ctr','0')
    cpc=row.get('cpc','0')
    print(f'  {name}: £{spend} spent | {imp} imp | {clicks} clicks | {ctr}% CTR | £{cpc} CPC')
" 2>/dev/null
echo ""
echo "--- Ad Level Breakdown ---"
echo "$AD_DATA" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for row in d.get('data',[]):
    name=row.get('ad_name','?')
    spend=row.get('spend','0')
    imp=row.get('impressions','0')
    clicks=row.get('clicks','0')
    ctr=row.get('ctr','0')
    print(f'  {name}: £{spend} spent | {imp} imp | {clicks} clicks | {ctr}% CTR')
" 2>/dev/null

# Alert thresholds
echo ""
echo "--- ALERTS ---"
python3 -c "
spend=float('$SPEND' or 0)
clicks=int('$CLICKS' or 0)
impressions=int('$IMPRESSIONS' or 0)
leads=int('$LEADS' or 0)
ctr=float('$CTR' or 0)

alerts=[]
if spend > 10 and clicks == 0:
    alerts.append('⚠️ £{:.2f} spent with ZERO clicks — check targeting/creative'.format(spend))
if spend > 20 and leads == 0:
    alerts.append('⚠️ £{:.2f} spent with ZERO leads — check pixel/landing page'.format(spend))
if impressions > 500 and ctr < 0.5:
    alerts.append('⚠️ CTR below 0.5% ({:.2f}%) after {} impressions — creative may need refresh'.format(ctr, impressions))
if spend > 5 and impressions < 50:
    alerts.append('⚠️ Low delivery: only {} impressions on £{:.2f} — possible audience/bid issue'.format(impressions, spend))

if alerts:
    for a in alerts:
        print(a)
else:
    print('✅ No alerts — metrics within normal range for early campaign')
"
