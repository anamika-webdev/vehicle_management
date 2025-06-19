// API Connection Test Component
// src/components/debug/ApiTestComponent.js

import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Play } from 'lucide-react';
import apiService from '../../services/api';

const ApiTestComponent = () => {
  const [tests, setTests] = useState({
    connection: { status: 'pending', message: 'Not tested' },
    health: { status: 'pending', message: 'Not tested' },
    login: { status: 'pending', message: 'Not tested' }
  });
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('akhand5@zuree.com');
  const [testPassword, setTestPassword] = useState('');

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
      case 'responding':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      default:
        return <div className="w-5 h-5 bg-gray-300 rounded-full" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success':
      case 'responding':
        return 'text-green-800 bg-green-100';
      case 'error':
        return 'text-red-800 bg-red-100';
      case 'warning':
        return 'text-yellow-800 bg-yellow-100';
      default:
        return 'text-gray-800 bg-gray-100';
    }
  };

  const runAllTests = async () => {
    setTesting(true);
    
    // Test 1: Basic connection
    try {
      console.log('🧪 Running connection test...');
      const connectionResult = await apiService.testConnection();
      setTests(prev => ({
        ...prev,
        connection: connectionResult
      }));
    } catch (error) {
      setTests(prev => ({
        ...prev,
        connection: { status: 'error', message: error.message }
      }));
    }

    // Test 2: Health check
    try {
      console.log('🧪 Running health check test...');
      await apiService.healthCheck();
      setTests(prev => ({
        ...prev,
        health: { status: 'success', message: 'Health endpoint is working' }
      }));
    } catch (error) {
      setTests(prev => ({
        ...prev,
        health: { status: 'error', message: error.message }
      }));
    }

    // Test 3: Login endpoint (with test credentials)
    try {
      console.log('🧪 Running login endpoint test...');
      const loginResult = await apiService.testLogin();
      setTests(prev => ({
        ...prev,
        login: loginResult
      }));
    } catch (error) {
      setTests(prev => ({
        ...prev,
        login: { status: 'error', message: error.message }
      }));
    }

    setTesting(false);
  };

  const testActualLogin = async () => {
    if (!testEmail || !testPassword) {
      alert('Please enter both email and password');
      return;
    }

    setTesting(true);
    try {
      console.log('🔐 Testing actual login with provided credentials...');
      const result = await apiService.login(testEmail, testPassword);
      setTests(prev => ({
        ...prev,
        login: { 
          status: 'success', 
          message: `Login successful! Token: ${result.token.substring(0, 20)}...` 
        }
      }));
      alert('Login successful! Check the console for token details.');
    } catch (error) {
      console.error('Login failed:', error);
      setTests(prev => ({
        ...prev,
        login: { status: 'error', message: error.message }
      }));
    }
    setTesting(false);
  };

  // Run basic tests on component mount
  useEffect(() => {
    runAllTests();
  }, []);

  return (
    <div className="max-w-2xl p-6 mx-auto bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="mb-2 text-2xl font-bold text-gray-900">API Connection Diagnostics</h2>
        <p className="text-gray-600">Testing connection to: http://164.52.194.198:9090</p>
      </div>

      {/* Basic Tests */}
      <div className="mb-8 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Basic Tests</h3>
          <button
            onClick={runAllTests}
            disabled={testing}
            className="flex items-center gap-2 px-4 py-2 text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
            Run Tests
          </button>
        </div>

        <div className="space-y-3">
          {/* Connection Test */}
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-3">
              {getStatusIcon(tests.connection.status)}
              <div>
                <h4 className="font-medium text-gray-900">Network Connection</h4>
                <p className="text-sm text-gray-600">Can reach the API server</p>
              </div>
            </div>
            <div className="text-right">
              <span className={`px-3 py-1 text-xs rounded-full ${getStatusColor(tests.connection.status)}`}>
                {tests.connection.status}
              </span>
              <p className="mt-1 text-xs text-gray-500">{tests.connection.message}</p>
            </div>
          </div>

          {/* Health Check Test */}
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-3">
              {getStatusIcon(tests.health.status)}
              <div>
                <h4 className="font-medium text-gray-900">Health Endpoint</h4>
                <p className="text-sm text-gray-600">API health check responds</p>
              </div>
            </div>
            <div className="text-right">
              <span className={`px-3 py-1 text-xs rounded-full ${getStatusColor(tests.health.status)}`}>
                {tests.health.status}
              </span>
              <p className="mt-1 text-xs text-gray-500">{tests.health.message}</p>
            </div>
          </div>

          {/* Login Endpoint Test */}
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-3">
              {getStatusIcon(tests.login.status)}
              <div>
                <h4 className="font-medium text-gray-900">Login Endpoint</h4>
                <p className="text-sm text-gray-600">Authentication endpoint responds</p>
              </div>
            </div>
            <div className="text-right">
              <span className={`px-3 py-1 text-xs rounded-full ${getStatusColor(tests.login.status)}`}>
                {tests.login.status}
              </span>
              <p className="mt-1 text-xs text-gray-500">{tests.login.message}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actual Login Test */}
      <div className="pt-6 border-t border-gray-200">
        <h3 className="mb-4 text-lg font-semibold text-gray-800">Test Your Login Credentials</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="your-email@example.com"
            />
          </div>
          
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              value={testPassword}
              onChange={(e) => setTestPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Your password"
            />
          </div>
          
          <button
            onClick={testActualLogin}
            disabled={testing || !testEmail || !testPassword}
            className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            Test Login
          </button>
        </div>
      </div>

      {/* Manual Testing Instructions */}
      <div className="p-4 mt-8 rounded-lg bg-blue-50">
        <h4 className="mb-2 font-medium text-blue-900">Manual Testing</h4>
        <p className="mb-2 text-sm text-blue-800">
          You can also test the API manually using these curl commands:
        </p>
        <div className="p-3 overflow-x-auto font-mono text-xs text-blue-100 bg-blue-900 rounded">
          <div className="mb-2"># Test connection:</div>
          <div className="mb-4">curl -X GET http://164.52.194.198:9090/health</div>
          
          <div className="mb-2"># Test login:</div>
          <div>curl -X POST http://164.52.194.198:9090/auth/v1/login \<br />
          &nbsp;&nbsp;-H "Content-Type: application/json" \<br />
          &nbsp;&nbsp;-d '{`{"email":"your-email@example.com","password":"your-password"}`}'</div>
        </div>
      </div>

      {/* Troubleshooting */}
      <div className="p-4 mt-6 rounded-lg bg-yellow-50">
        <h4 className="mb-2 font-medium text-yellow-900">Troubleshooting</h4>
        <ul className="space-y-1 text-sm text-yellow-800">
          <li>• If connection fails: Check firewall/network settings</li>
          <li>• If health check fails: API server may be down</li>
          <li>• If login fails with 401: Wrong email/password</li>
          <li>• If login fails with network error: Connection issue</li>
        </ul>
      </div>
    </div>
  );
};

export default ApiTestComponent;