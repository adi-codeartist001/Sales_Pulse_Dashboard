from flask import Flask, jsonify, make_response
import requests
from dotenv import load_dotenv
import os

app = Flask(__name__)
load_dotenv()

SUPABASE_URL = os.environ.get("supabase_url")
API_KEY = os.environ.get("apikey")
ALLOWED_ORIGIN = os.environ.get("allowed_origin", "*")


def with_cors(response):
    """Attach the CORS header so the browser lets the frontend read the response."""
    response.headers["Access-Control-Allow-Origin"] = ALLOWED_ORIGIN
    return response


@app.route("/", methods=["GET"])
def health():
    return with_cors(jsonify({"status": "ok", "service": "salespulse-backend"}))


@app.route("/getData/<report_date>", methods=["GET"])
def get_dashboard_data(report_date):
    if not SUPABASE_URL or not API_KEY:
        return with_cors(make_response(
            jsonify({"error": "Server misconfigured: missing supabase_url or apikey env vars"}),
            500
        ))

    payload = {"report_date": report_date}
    headers = {"Content-Type": "application/json", "apikey": API_KEY}

    try:
        upstream = requests.post(SUPABASE_URL, json=payload, headers=headers, timeout=10)
        upstream.raise_for_status()
    except requests.exceptions.RequestException as exc:
        return with_cors(make_response(
            jsonify({"error": "Failed to reach Supabase", "detail": str(exc)}),
            502
        ))

    response = make_response(jsonify(upstream.json()))
    return with_cors(response)


if __name__ == "__main__":
    app.run(debug=True)
