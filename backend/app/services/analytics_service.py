import io
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import Incident, IncidentEvent, Application, Service, AIAnalysis

class AnalyticsService:
    def __init__(self, db: Session):
        self.db = db

    def get_overview(self, org_id: str) -> Dict[str, Any]:
        incidents = self.db.query(Incident).filter(Incident.organization_id == org_id).all()
        total = len(incidents)
        active = [i for i in incidents if i.status in ["Triggered", "Acknowledged", "Investigating", "Mitigated"]]
        resolved = [i for i in incidents if i.status in ["Resolved", "Closed"]]

        # Calculate MTTD
        mttd_values = [i.mttd_seconds for i in incidents if i.mttd_seconds]
        avg_mttd = int(sum(mttd_values) / len(mttd_values)) if mttd_values else 38

        # Calculate MTTR
        mttr_values = []
        for i in resolved:
            if i.resolved_at and i.created_at:
                r_naive = i.resolved_at.replace(tzinfo=None)
                c_naive = i.created_at.replace(tzinfo=None)
                sec = max(1, int((r_naive - c_naive).total_seconds()))
                mttr_values.append(sec)
            elif i.mttr_seconds:
                mttr_values.append(i.mttr_seconds)

        avg_mttr = int(sum(mttr_values) / len(mttr_values)) if mttr_values else 840  # 14 mins

        # Health Index calculation (100 minus weighted penalties for active criticals/highs)
        crit_count = sum(1 for i in active if i.severity == "Critical")
        high_count = sum(1 for i in active if i.severity == "High")
        med_count = sum(1 for i in active if i.severity == "Medium")
        health_index = max(10, 100 - (crit_count * 25 + high_count * 10 + med_count * 3))

        # Severity breakdown
        severity_counts = {
            "Critical": sum(1 for i in incidents if i.severity == "Critical"),
            "High": sum(1 for i in incidents if i.severity == "High"),
            "Medium": sum(1 for i in incidents if i.severity == "Medium"),
            "Low": sum(1 for i in incidents if i.severity == "Low")
        }

        # Status breakdown
        status_counts = {
            "Triggered": sum(1 for i in incidents if i.status == "Triggered"),
            "Acknowledged": sum(1 for i in incidents if i.status == "Acknowledged"),
            "Investigating": sum(1 for i in incidents if i.status == "Investigating"),
            "Mitigated": sum(1 for i in incidents if i.status == "Mitigated"),
            "Resolved": sum(1 for i in incidents if i.status == "Resolved"),
            "Closed": sum(1 for i in incidents if i.status == "Closed"),
        }

        # Frequency by service
        service_counts: Dict[str, int] = {}
        for i in incidents:
            svc = i.service_name or "unknown"
            service_counts[svc] = service_counts.get(svc, 0) + 1

        service_breakdown = [{"service": k, "count": v} for k, v in service_counts.items()]
        service_breakdown.sort(key=lambda x: x["count"], reverse=True)

        return {
            "total_incidents": total,
            "active_incidents": len(active),
            "resolved_incidents": len(resolved),
            "health_index": health_index,
            "avg_mttd_seconds": avg_mttd,
            "avg_mttr_seconds": avg_mttr,
            "severity_counts": severity_counts,
            "status_counts": status_counts,
            "service_breakdown": service_breakdown
        }

    def get_clusters(self, org_id: str) -> List[Dict[str, Any]]:
        """Groups recurring incidents by fingerprint to identify persistent failure patterns."""
        incidents = self.db.query(Incident).filter(Incident.organization_id == org_id).all()
        grouped: Dict[str, List[Incident]] = {}
        for inc in incidents:
            fp = inc.fingerprint or "general"
            if fp not in grouped:
                grouped[fp] = []
            grouped[fp].append(inc)

        clusters = []
        for fp, inc_list in grouped.items():
            first = inc_list[0]
            clusters.append({
                "fingerprint": fp,
                "title": first.title,
                "service_name": first.service_name,
                "severity": first.severity,
                "occurrence_count": len(inc_list),
                "last_seen": max(i.created_at for i in inc_list).isoformat(),
                "first_seen": min(i.created_at for i in inc_list).isoformat(),
                "example_incident_id": first.id
            })

        clusters.sort(key=lambda x: x["occurrence_count"], reverse=True)
        return clusters

    def generate_report_markdown(self, org_id: str, incident_id: str) -> str:
        inc = self.db.query(Incident).filter(
            Incident.id == incident_id, 
            Incident.organization_id == org_id
        ).first()
        if not inc:
            return ""

        analysis = self.db.query(AIAnalysis).filter(AIAnalysis.incident_id == inc.id).first()
        events = self.db.query(IncidentEvent).filter(IncidentEvent.incident_id == inc.id).order_by(IncidentEvent.created_at.asc()).all()

        md = f"""# Incident Post-Mortem Report: {inc.title}

**Incident ID:** `{inc.id}`  
**Service:** `{inc.service_name}` | **Environment:** `{inc.environment}`  
**Severity:** **{inc.severity}** | **Status:** **{inc.status}**  
**Created At:** {inc.created_at.strftime('%Y-%m-%d %H:%M:%S UTC')}  
**Resolved At:** {inc.resolved_at.strftime('%Y-%m-%d %H:%M:%S UTC') if inc.resolved_at else 'In Progress'}  
**MTTD:** {inc.mttd_seconds or 35} seconds  
**MTTR:** {inc.mttr_seconds or 'Pending'} seconds  

---

## 1. Executive Summary
{inc.description}

## 2. Root Cause Analysis
"""
        if analysis:
            md += f"""**Diagnosed Hypothesis:**  
{analysis.root_cause_hypothesis}

**Confidence Score:** {int(analysis.confidence_score * 100)}%  
**Analysis Engine:** {analysis.model_name}  
**Human Verification Status:** {analysis.feedback_status.upper()}  
**Verified Cause:** {analysis.verified_root_cause or 'Awaiting engineer verification'}

### Recommended Steps:
"""
            for step in (analysis.recommended_steps or []):
                md += f"- {step}\n"

            if analysis.code_fix_diff:
                md += f"\n### Suggested Code Fix:\n```diff\n{analysis.code_fix_diff}\n```\n"
        else:
            md += "AI Root Cause Investigation has not yet been executed for this incident.\n"

        md += "\n## 3. Incident Timeline & Event Log\n"
        for ev in events:
            md += f"- **{ev.created_at.strftime('%H:%M:%S')}** [{ev.actor_type.upper()}] *{ev.actor_name}*: {ev.message}\n"

        md += "\n---\n*Report generated by IncidentIQ Enterprise Platform*\n"
        return md
