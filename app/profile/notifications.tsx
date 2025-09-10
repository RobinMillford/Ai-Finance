"use client";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useState, useEffect } from "react";
import { toast } from "sonner";

interface NotificationPreferences {
  email: boolean;
  marketAlerts: boolean;
  priceChanges: boolean;
  portfolioUpdates: boolean;
  aiRecommendations: boolean;
}

export default function NotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    email: true,
    marketAlerts: true,
    priceChanges: true,
    portfolioUpdates: true,
    aiRecommendations: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const response = await fetch('/api/user/notifications');
      if (response.ok) {
        const data = await response.json();
        setPreferences(data.notificationPreferences);
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
      toast.error('Failed to load notification preferences');
    } finally {
      setLoading(false);
    }
  };

  const updatePreferences = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/user/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferences),
      });
      
      if (response.ok) {
        toast.success('Notification preferences updated successfully');
      } else {
        toast.error('Failed to update notification preferences');
      }
    } catch (error) {
      console.error('Error updating preferences:', error);
      toast.error('An error occurred while updating preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (key: keyof NotificationPreferences, value: boolean) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (loading) {
    return <div>Loading preferences...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Email Notifications</h3>
          <p className="text-sm text-muted-foreground">Receive updates via email</p>
        </div>
        <Switch
          checked={preferences.email}
          onCheckedChange={(checked) => handleToggle('email', checked)}
        />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Market Alerts</h3>
          <p className="text-sm text-muted-foreground">Get notified about significant market movements</p>
        </div>
        <Switch
          checked={preferences.marketAlerts}
          onCheckedChange={(checked) => handleToggle('marketAlerts', checked)}
        />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Price Changes</h3>
          <p className="text-sm text-muted-foreground">Notifications for price threshold changes</p>
        </div>
        <Switch
          checked={preferences.priceChanges}
          onCheckedChange={(checked) => handleToggle('priceChanges', checked)}
        />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Portfolio Updates</h3>
          <p className="text-sm text-muted-foreground">Daily portfolio performance summaries</p>
        </div>
        <Switch
          checked={preferences.portfolioUpdates}
          onCheckedChange={(checked) => handleToggle('portfolioUpdates', checked)}
        />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">AI Advisor Recommendations</h3>
          <p className="text-sm text-muted-foreground">Receive AI-generated investment advice</p>
        </div>
        <Switch
          checked={preferences.aiRecommendations}
          onCheckedChange={(checked) => handleToggle('aiRecommendations', checked)}
        />
      </div>
      <Button 
        onClick={updatePreferences} 
        className="w-full mt-4 bg-primary hover:bg-primary/90"
        disabled={saving}
      >
        {saving ? "Saving..." : "Save Preferences"}
      </Button>
    </div>
  );
}