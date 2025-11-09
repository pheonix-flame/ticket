import requests
import json

# ⚠️ REPLACE THIS WITH YOUR ACTUAL GOOGLE APPS SCRIPT /EXEC URL
SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzlkVH9uyck5JtkAaCSsnyM9TbH_CL9WcJGi7M6sy6cOj3Dm_FARwibMYPR_pJ7ZD4N/exec'

# ⚠️ REPLACE WITH A VALID USERNAME AND PASSWORD FROM YOUR SPREADSHEET
LOGIN_USERNAME = 'testuser'
LOGIN_PASSWORD = 'password123'

# --- Test Login Endpoint ---
def test_login():
    print(f"--- Attempting Login for User: {LOGIN_USERNAME} ---")
    
    # 1. Define the payload
    payload = {
        'action': 'login',
        'username': LOGIN_USERNAME,
        'password': LOGIN_PASSWORD
    }

    # 2. Define headers (Crucial for telling the script it's JSON)
    headers = {
        'Content-Type': 'application/json'
    }

    try:
        # 3. Send the POST request
        response = requests.post(
            SCRIPT_URL, 
            headers=headers, 
            data=json.dumps(payload)
        )
        
        # 4. Handle response
        print(f"Status Code: {response.status_code}")
        print("Response Body:")
        
        # Google Apps Script returns content as text, which we parse as JSON
        try:
            result = response.json()
            print(json.dumps(result, indent=4))
        except json.JSONDecodeError:
            print("Failed to decode JSON response.")
            print(response.text)

    except requests.exceptions.RequestException as e:
        print(f"An error occurred during the request: {e}")

if __name__ == '__main__':
    test_login()