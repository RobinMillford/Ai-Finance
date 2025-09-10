"use client";

import { useAuth } from '@/hooks/useAuth';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { toast } from "sonner";

export default function ProfileSettings() {
  const { session } = useAuth();
  const [name, setName] = useState(session?.user?.name || '');
  const [email, setEmail] = useState(session?.user?.email || '');
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, isPublic }),
      });
      
      if (response.ok) {
        toast.success('Profile updated successfully');
      } else {
        toast.error('Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('An error occurred while updating your profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Profile Settings */}
      <Card className="p-6 bg-card/50 backdrop-blur-sm border border-primary/10 shadow-xl">
        <CardHeader>
          <CardTitle>Profile Settings</CardTitle>
          <CardDescription>Manage your profile information</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-background/50 border-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-background/50 border-primary/20"
                disabled
              />
              <p className="text-sm text-muted-foreground">Email cannot be changed</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="public">Public Profile</Label>
                <p className="text-sm text-muted-foreground">Allow others to view your profile</p>
              </div>
              <Switch
                id="public"
                checked={isPublic}
                onCheckedChange={setIsPublic}
              />
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card className="p-6 bg-card/50 backdrop-blur-sm border border-primary/10 shadow-xl">
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>Manage your security settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <h3 className="font-medium mb-2">Password</h3>
              <p className="text-sm text-muted-foreground mb-4">Update your password regularly to keep your account secure</p>
              <Button variant="outline" className="border-primary/20 hover:bg-primary/10">
                Change Password
              </Button>
            </div>
            <div>
              <h3 className="font-medium mb-2">Two-Factor Authentication</h3>
              <p className="text-sm text-muted-foreground mb-4">Add an extra layer of security to your account</p>
              <Button variant="outline" className="border-primary/20 hover:bg-primary/10">
                Enable 2FA
              </Button>
            </div>
            <div>
              <h3 className="font-medium mb-2">Active Sessions</h3>
              <p className="text-sm text-muted-foreground mb-4">Manage devices that are currently signed in</p>
              <Button variant="outline" className="border-primary/20 hover:bg-primary/10">
                View Sessions
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Privacy Settings */}
      <Card className="p-6 bg-card/50 backdrop-blur-sm border border-primary/10 shadow-xl lg:col-span-2">
        <CardHeader>
          <CardTitle>Privacy Settings</CardTitle>
          <CardDescription>Control what information you share</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Profile Visibility</h3>
                  <p className="text-sm text-muted-foreground">Who can see your profile</p>
                </div>
                <Button variant="outline" size="sm" className="border-primary/20 hover:bg-primary/10">
                  Public
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Portfolio Visibility</h3>
                  <p className="text-sm text-muted-foreground">Who can see your portfolio</p>
                </div>
                <Button variant="outline" size="sm" className="border-primary/20 hover:bg-primary/10">
                  Private
                </Button>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Activity Tracking</h3>
                  <p className="text-sm text-muted-foreground">Track your activity on the platform</p>
                </div>
                <Button variant="outline" size="sm" className="border-primary/20 hover:bg-primary/10">
                  Enabled
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Data Collection</h3>
                  <p className="text-sm text-muted-foreground">Allow us to collect usage data</p>
                </div>
                <Button variant="outline" size="sm" className="border-primary/20 hover:bg-primary/10">
                  Enabled
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}