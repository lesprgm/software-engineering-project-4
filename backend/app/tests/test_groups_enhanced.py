"""
Enhanced test suite for groups functionality with comprehensive coverage.
"""
import pytest
from datetime import datetime, timezone
from fastapi import HTTPException

from app.models import Group, GroupMembership, GroupMessage, User
from app.services.groups import GroupService, GroupQueryService


class TestGroupCreation:
    """Tests for group creation and initialization."""
    
    def test_create_group_assigns_owner_role(self, db_session):
        """Group creator automatically gets owner role."""
        owner = User(id="owner-1", email="owner@test.com", display_name="Owner")
        db_session.add(owner)
        db_session.commit()
        
        group = GroupService.create_group(
            db_session,
            name="Leadership Team",
            description="Executive planning group",
            owner_id=owner.id,
        )
        db_session.commit()
        
        # Verify group created
        assert group.name == "Leadership Team"
        assert group.description == "Executive planning group"
        assert group.invite_code is not None
        assert len(group.invite_code) > 0
        
        # Verify owner membership
        memberships = db_session.query(GroupMembership).filter_by(
            group_id=group.id
        ).all()
        assert len(memberships) == 1
        assert memberships[0].user_id == owner.id
        assert memberships[0].role == "owner"
    
    def test_create_group_generates_unique_invite_codes(self, db_session):
        """Each group gets a unique invite code."""
        owner = User(id="owner-multi", email="owner@multi.com", display_name="Owner")
        db_session.add(owner)
        db_session.commit()
        
        invite_codes = set()
        for i in range(10):
            group = GroupService.create_group(
                db_session,
                name=f"Group {i}",
                description=None,
                owner_id=owner.id,
            )
            invite_codes.add(group.invite_code)
        
        db_session.commit()
        
        # All invite codes should be unique
        assert len(invite_codes) == 10
    
    def test_create_group_without_description(self, db_session):
        """Groups can be created without description."""
        owner = User(id="owner-nodesc", email="owner@nodesc.com", display_name="Owner")
        db_session.add(owner)
        db_session.commit()
        
        group = GroupService.create_group(
            db_session,
            name="Simple Group",
            description=None,
            owner_id=owner.id,
        )
        db_session.commit()
        
        assert group.description is None
        assert group.name == "Simple Group"
    
    def test_create_group_with_nonexistent_owner_fails(self, db_session):
        """Creating group with invalid owner_id raises error."""
        with pytest.raises(HTTPException) as exc:
            GroupService.create_group(
                db_session,
                name="Orphan Group",
                description=None,
                owner_id="nonexistent-user",
            )
        
        assert exc.value.status_code == 404
        assert "owner not found" in exc.value.detail.lower()


class TestGroupMembership:
    """Tests for joining groups and membership management."""
    
    def test_join_group_with_valid_code(self, db_session):
        """Users can join group with correct invite code."""
        owner = User(id="owner-join", email="owner@join.com", display_name="Owner")
        member = User(id="member-join", email="member@join.com", display_name="Member")
        db_session.add_all([owner, member])
        db_session.commit()
        
        group = GroupService.create_group(
            db_session,
            name="Join Test",
            description="Testing joins",
            owner_id=owner.id,
        )
        db_session.commit()
        
        # Member joins
        updated_group = GroupService.join_group(
            db_session,
            group_id=group.id,
            user_id=member.id,
            invite_code=group.invite_code,
        )
        db_session.commit()
        
        # Verify membership
        memberships = db_session.query(GroupMembership).filter_by(
            group_id=group.id
        ).all()
        assert len(memberships) == 2
        
        member_roles = {m.user_id: m.role for m in memberships}
        assert member_roles[owner.id] == "owner"
        assert member_roles[member.id] == "member"
    
    def test_join_group_with_invalid_code_fails(self, db_session):
        """Joining with wrong invite code raises error."""
        owner = User(id="owner-inv", email="owner@inv.com", display_name="Owner")
        member = User(id="member-inv", email="member@inv.com", display_name="Member")
        db_session.add_all([owner, member])
        db_session.commit()
        
        group = GroupService.create_group(
            db_session,
            name="Invalid Code Test",
            description=None,
            owner_id=owner.id,
        )
        db_session.commit()
        
        with pytest.raises(HTTPException) as exc:
            GroupService.join_group(
                db_session,
                group_id=group.id,
                user_id=member.id,
                invite_code="wrong-code",
            )
        
        assert exc.value.status_code == 403
        assert "invalid invite code" in exc.value.detail.lower()
    
    def test_join_same_group_twice_is_idempotent(self, db_session):
        """Joining a group already in doesn't create duplicate membership."""
        owner = User(id="owner-twice", email="owner@twice.com", display_name="Owner")
        member = User(id="member-twice", email="member@twice.com", display_name="Member")
        db_session.add_all([owner, member])
        db_session.commit()
        
        group = GroupService.create_group(
            db_session,
            name="Idempotent Test",
            description=None,
            owner_id=owner.id,
        )
        db_session.commit()
        
        # Join twice
        GroupService.join_group(db_session, group_id=group.id, user_id=member.id, invite_code=group.invite_code)
        GroupService.join_group(db_session, group_id=group.id, user_id=member.id, invite_code=group.invite_code)
        db_session.commit()
        
        # Should only have 2 memberships (owner + member)
        memberships = db_session.query(GroupMembership).filter_by(group_id=group.id).all()
        assert len(memberships) == 2
    
    def test_join_nonexistent_group_fails(self, db_session):
        """Joining non-existent group raises error."""
        member = User(id="member-nogroup", email="member@nogroup.com", display_name="Member")
        db_session.add(member)
        db_session.commit()
        
        with pytest.raises(HTTPException) as exc:
            GroupService.join_group(
                db_session,
                group_id="fake-group-id",
                user_id=member.id,
                invite_code="any-code",
            )
        
        assert exc.value.status_code == 404
        assert "group not found" in exc.value.detail.lower()


class TestGroupMessaging:
    """Tests for group messaging functionality."""
    
    def test_post_message_as_member(self, db_session):
        """Group members can post messages."""
        owner = User(id="owner-msg", email="owner@msg.com", display_name="Owner")
        member = User(id="member-msg", email="member@msg.com", display_name="Member")
        db_session.add_all([owner, member])
        db_session.commit()
        
        group = GroupService.create_group(
            db_session,
            name="Chat Test",
            description=None,
            owner_id=owner.id,
        )
        GroupService.join_group(db_session, group_id=group.id, user_id=member.id, invite_code=group.invite_code)
        db_session.commit()
        
        message = GroupService.post_message(
            db_session,
            group_id=group.id,
            user_id=member.id,
            content="Hello everyone!",
        )
        db_session.commit()
        
        assert message.content == "Hello everyone!"
        assert message.user_id == member.id
        assert message.group_id == group.id
        assert message.created_at is not None
    
    def test_post_message_as_non_member_fails(self, db_session):
        """Non-members cannot post messages."""
        owner = User(id="owner-nonmem", email="owner@nonmem.com", display_name="Owner")
        outsider = User(id="outsider", email="outsider@test.com", display_name="Outsider")
        db_session.add_all([owner, outsider])
        db_session.commit()
        
        group = GroupService.create_group(
            db_session,
            name="Private Chat",
            description=None,
            owner_id=owner.id,
        )
        db_session.commit()
        
        with pytest.raises(HTTPException) as exc:
            GroupService.post_message(
                db_session,
                group_id=group.id,
                user_id=outsider.id,
                content="Trying to infiltrate!",
            )
        
        assert exc.value.status_code == 403
        assert "not part of the group" in exc.value.detail.lower()
    
    def test_list_messages_pagination(self, db_session):
        """Message listing supports pagination."""
        owner = User(id="owner-page", email="owner@page.com", display_name="Owner")
        db_session.add(owner)
        db_session.commit()
        
        group = GroupService.create_group(
            db_session,
            name="Pagination Test",
            description=None,
            owner_id=owner.id,
        )
        db_session.commit()
        
        # Post 25 messages
        for i in range(25):
            GroupService.post_message(
                db_session,
                group_id=group.id,
                user_id=owner.id,
                content=f"Message {i}",
            )
        db_session.commit()
        
        # Get first page (10 messages)
        page1 = GroupService.list_messages(db_session, group_id=group.id, limit=10, offset=0)
        assert len(page1.messages) == 10
        assert page1.total == 25
        
        # Get second page
        page2 = GroupService.list_messages(db_session, group_id=group.id, limit=10, offset=10)
        assert len(page2.messages) == 10
        assert page2.total == 25
        
        # Get third page
        page3 = GroupService.list_messages(db_session, group_id=group.id, limit=10, offset=20)
        assert len(page3.messages) == 5
        assert page3.total == 25
        
        # Ensure messages are different on each page
        page1_ids = {m.id for m in page1.messages}
        page2_ids = {m.id for m in page2.messages}
        page3_ids = {m.id for m in page3.messages}
        assert len(page1_ids & page2_ids) == 0
        assert len(page2_ids & page3_ids) == 0
    
    def test_list_messages_empty_group(self, db_session):
        """Listing messages in empty group returns empty result."""
        owner = User(id="owner-empty", email="owner@empty.com", display_name="Owner")
        db_session.add(owner)
        db_session.commit()
        
        group = GroupService.create_group(
            db_session,
            name="Empty Chat",
            description=None,
            owner_id=owner.id,
        )
        db_session.commit()
        
        result = GroupService.list_messages(db_session, group_id=group.id, limit=50, offset=0)
        
        assert result.total == 0
        assert len(result.messages) == 0
    
    def test_messages_ordered_chronologically(self, db_session):
        """Messages are returned in chronological order."""
        owner = User(id="owner-order", email="owner@order.com", display_name="Owner")
        db_session.add(owner)
        db_session.commit()
        
        group = GroupService.create_group(
            db_session,
            name="Order Test",
            description=None,
            owner_id=owner.id,
        )
        db_session.commit()
        
        # Post messages
        message_ids = []
        for i in range(5):
            msg = GroupService.post_message(
                db_session,
                group_id=group.id,
                user_id=owner.id,
                content=f"Message {i}",
            )
            message_ids.append(msg.id)
            db_session.flush()
        
        db_session.commit()
        
        # Get messages
        result = GroupService.list_messages(db_session, group_id=group.id, limit=50, offset=0)
        
        # Verify chronological order (ascending by created_at)
        for i in range(len(result.messages) - 1):
            assert result.messages[i].created_at <= result.messages[i + 1].created_at


class TestGroupQueries:
    """Tests for group query operations."""
    
    def test_list_all_groups(self, db_session):
        """Can retrieve all groups."""
        owner = User(id="owner-list", email="owner@list.com", display_name="Owner")
        db_session.add(owner)
        db_session.commit()
        
        # Create multiple groups
        for i in range(5):
            GroupService.create_group(
                db_session,
                name=f"Group {i}",
                description=f"Description {i}",
                owner_id=owner.id,
            )
        db_session.commit()
        
        groups = list(GroupQueryService.list_groups(db_session))
        assert len(groups) >= 5  # At least our 5, maybe more from other tests
        
        # Verify our groups are in the list
        group_names = {g.name for g in groups}
        for i in range(5):
            assert f"Group {i}" in group_names
    
    def test_get_group_with_details(self, db_session):
        """Getting group includes members and availability."""
        owner = User(id="owner-detail", email="owner@detail.com", display_name="Owner")
        member = User(id="member-detail", email="member@detail.com", display_name="Member")
        db_session.add_all([owner, member])
        db_session.commit()
        
        group = GroupService.create_group(
            db_session,
            name="Detail Test",
            description="Testing details",
            owner_id=owner.id,
        )
        GroupService.join_group(db_session, group_id=group.id, user_id=member.id, invite_code=group.invite_code)
        db_session.commit()
        
        # Get group with details
        detailed_group = GroupService.get_group(db_session, group_id=group.id)
        
        assert detailed_group.id == group.id
        assert detailed_group.name == "Detail Test"
        assert len(detailed_group.members) == 2
        
        # Verify members are loaded
        member_ids = {m.user_id for m in detailed_group.members}
        assert owner.id in member_ids
        assert member.id in member_ids
    
    def test_get_nonexistent_group_fails(self, db_session):
        """Getting non-existent group raises error."""
        with pytest.raises(HTTPException) as exc:
            GroupService.get_group(db_session, group_id="fake-group-id")
        
        assert exc.value.status_code == 404
        assert "group not found" in exc.value.detail.lower()
    
    def test_get_member_ids(self, db_session):
        """Can retrieve list of member IDs for a group."""
        owner = User(id="owner-memids", email="owner@memids.com", display_name="Owner")
        member1 = User(id="member1-memids", email="member1@memids.com", display_name="Member 1")
        member2 = User(id="member2-memids", email="member2@memids.com", display_name="Member 2")
        db_session.add_all([owner, member1, member2])
        db_session.commit()
        
        group = GroupService.create_group(
            db_session,
            name="Member IDs Test",
            description=None,
            owner_id=owner.id,
        )
        GroupService.join_group(db_session, group_id=group.id, user_id=member1.id, invite_code=group.invite_code)
        GroupService.join_group(db_session, group_id=group.id, user_id=member2.id, invite_code=group.invite_code)
        db_session.commit()
        
        member_ids = GroupService.get_member_ids(db_session, group_id=group.id)
        
        assert len(member_ids) == 3
        assert owner.id in member_ids
        assert member1.id in member_ids
        assert member2.id in member_ids


class TestInviteLinks:
    """Tests for group invite link generation."""
    
    def test_get_invite_link_format(self, db_session):
        """Invite link has correct format."""
        owner = User(id="owner-link", email="owner@link.com", display_name="Owner")
        db_session.add(owner)
        db_session.commit()
        
        group = GroupService.create_group(
            db_session,
            name="Link Test",
            description=None,
            owner_id=owner.id,
        )
        db_session.commit()
        
        invite_url = GroupService.get_invite_link(group)
        
        assert invite_url.startswith("https://")
        assert group.invite_code in invite_url
        assert "/join/" in invite_url
    
    def test_different_groups_have_different_links(self, db_session):
        """Each group has a unique invite link."""
        owner = User(id="owner-multi", email="owner@multi.com", display_name="Owner")
        db_session.add(owner)
        db_session.commit()
        
        links = set()
        for i in range(3):
            group = GroupService.create_group(
                db_session,
                name=f"Link Group {i}",
                description=None,
                owner_id=owner.id,
            )
            link = GroupService.get_invite_link(group)
            links.add(link)
        
        assert len(links) == 3, "All invite links should be unique"


class TestStressAndPerformance:
    """Stress tests and performance considerations."""
    
    def test_many_members_in_group(self, db_session):
        """Group can handle many members."""
        owner = User(id="owner-many", email="owner@many.com", display_name="Owner")
        db_session.add(owner)
        db_session.commit()
        
        group = GroupService.create_group(
            db_session,
            name="Large Group",
            description=None,
            owner_id=owner.id,
        )
        db_session.commit()
        
        # Add 50 members
        for i in range(50):
            member = User(id=f"member-many-{i}", email=f"member{i}@many.com", display_name=f"Member {i}")
            db_session.add(member)
            db_session.flush()
            GroupService.join_group(
                db_session,
                group_id=group.id,
                user_id=member.id,
                invite_code=group.invite_code,
            )
        
        db_session.commit()
        
        # Verify all members
        member_ids = GroupService.get_member_ids(db_session, group_id=group.id)
        assert len(member_ids) == 51  # Owner + 50 members
    
    def test_many_messages_in_group(self, db_session):
        """Group can handle many messages."""
        owner = User(id="owner-msgs", email="owner@msgs.com", display_name="Owner")
        db_session.add(owner)
        db_session.commit()
        
        group = GroupService.create_group(
            db_session,
            name="Message Spam",
            description=None,
            owner_id=owner.id,
        )
        db_session.commit()
        
        # Post 100 messages
        for i in range(100):
            GroupService.post_message(
                db_session,
                group_id=group.id,
                user_id=owner.id,
                content=f"Message {i}",
            )
        
        db_session.commit()
        
        # Verify count
        result = GroupService.list_messages(db_session, group_id=group.id, limit=1, offset=0)
        assert result.total == 100
