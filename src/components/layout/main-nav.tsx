
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  BookUser,
  Calendar,
  ClipboardList,
  FileBarChart2,
  Settings,
  GraduationCap,
  PieChart,
  Award,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import {
  Sidebar,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from '@/components/ui/sidebar';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/students', icon: Users, label: 'Students' },
  { href: '/teachers', icon: BookUser, label: 'Teachers' },
  { href: '/academics', icon: GraduationCap, label: 'Academics' },
  { href: '/bece', icon: Award, label: 'BECE Academic performance' },
  { href: '/calendar', icon: Calendar, label: 'Calendar' },
  { href: '/attendance', icon: ClipboardList, label: 'Attendance' },
  { href: '/reports', icon: FileBarChart2, label: 'Report Cards' },
  { href: '/analysis', icon: PieChart, label: 'Analysis' },
];

const settingsNav = { href: '/settings', icon: Settings, label: 'Settings' };

export function MainNav() {
  const pathname = usePathname();
  const defaultSchoolLogo = PlaceHolderImages.find(img => img.id === 'school_logo');
  const [schoolLogoUrl, setSchoolLogoUrl] = useState(defaultSchoolLogo?.imageUrl || '');

  useEffect(() => {
    const updateLogo = () => {
        const savedLogo = localStorage.getItem('school-logo');
        if (savedLogo) {
            setSchoolLogoUrl(savedLogo);
        }
    };
    
    updateLogo();
    window.addEventListener('storage_change', updateLogo);

    return () => {
        window.removeEventListener('storage_change', updateLogo);
    };
  }, []);

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
            {schoolLogoUrl ? (
                <div className="h-10 w-10 relative flex-shrink-0 flex items-center justify-center rounded-lg border bg-background overflow-hidden p-0.5">
                  <img
                    src={schoolLogoUrl}
                    alt="School Logo"
                    className="h-full w-full object-contain rounded-md"
                    onError={() => setSchoolLogoUrl('')}
                  />
                </div>
            ) : null}
            <div className="flex flex-col">
                <h2 className="text-lg font-headline font-semibold">UP JHS Hub</h2>
                <p className="text-xs text-muted-foreground">Academic Portal</p>
            </div>
        </div>
      </SidebarHeader>
      <SidebarMenu className="flex-1">
        {navItems.map((item) => (
          <SidebarMenuItem key={item.href}>
            <Link href={item.href}>
              <SidebarMenuButton
                isActive={pathname.startsWith(item.href)}
                tooltip={item.label}
              >
                <item.icon />
                <span>{item.label}</span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
      <SidebarFooter>
        <SidebarMenu>
            <SidebarMenuItem>
            <Link href={settingsNav.href}>
                <SidebarMenuButton
                isActive={pathname.startsWith(settingsNav.href)}
                tooltip={settingsNav.label}
                >
                <settingsNav.icon />
                <span>{settingsNav.label}</span>
                </SidebarMenuButton>
            </Link>
            </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
